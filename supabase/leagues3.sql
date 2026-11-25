-- leagues3.sql · v0.0.102–0.0.107: repeticiones, resultado de ayer, vitrina y tarjeta de ligas.
-- Ejecutar DESPUÉS de leagues.sql y leagues2.sql (necesita league_points, is_league_member, daily_today, fmt_ms, user_streak...).
-- Es idempotente: se puede lanzar varias veces. Este fichero reúne lo que ya estaba aplicado en el proyecto drift-rush.

-- Repeticiones: fantasmas de todos los pilotos de una liga (solo miembros, solo hoy y ayer).
create or replace function public.league_day_ghosts(p_league uuid, p_day date, p_user uuid default null) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or not public.is_league_member(p_league, auth.uid()) then raise exception 'No perteneces a esta liga'; end if;
  if p_day > public.daily_today() then raise exception 'Ese día aún no ha llegado'; end if;
  if p_day < public.daily_today() - 1 then raise exception 'Las repeticiones solo se guardan 24 horas'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('user_id', r.player_id, 'username', pr.username, 'flag', pr.flag, 'helmet', pr.helmet, 'car', r.car_id, 'track', r.track_id, 'ms', r.lap_ms, 'ghost', r.ghost) order by r.lap_ms), '[]'::jsonb)
    from public.daily_results r
    join public.league_members m on m.user_id = r.player_id and m.league_id = p_league
    join public.profiles pr on pr.user_id = r.player_id
    where r.day = p_day and r.ghost is not null and (p_user is null or r.player_id = p_user));
end $$;

-- Borra los fantasmas con más de 24 h.
create or replace function public.purge_old_replays() returns void language sql security definer set search_path to 'public' as $$
  update public.daily_results set ghost = null where ghost is not null and day < public.daily_today() - 1;
$$;

-- Mensaje automático «Resultado de ayer» en el chat de cada liga al empezar el día.
create or replace function public.league_newday_post() returns void language plpgsql security definer set search_path to 'public' as $$
declare t date := public.daily_today(); l record; w record; n int;
begin
  for l in select id from public.leagues loop
    if exists (select 1 from public.league_messages where league_id = l.id and kind = 'sys' and body like '🎬%' and created_at > now() - interval '20 hours') then continue; end if;
    select count(*) into n from public.daily_results r join public.league_members m on m.user_id = r.player_id and m.league_id = l.id where r.day = t - 1;
    if n < 1 then continue; end if;
    select r.player_id, r.lap_ms, p.username into w from public.daily_results r join public.league_members m on m.user_id = r.player_id and m.league_id = l.id join public.profiles p on p.user_id = r.player_id
      where r.day = t - 1 order by r.lap_ms, r.updated_at limit 1;
    insert into public.league_messages(league_id, user_id, body, kind) values (l.id, w.player_id, '🎬 Resultado de ayer: ganó @' || w.username || ' con ' || public.fmt_ms(w.lap_ms) || ' · ' || n || ' piloto' || case when n = 1 then '' else 's' end, 'sys');
  end loop;
end $$;

-- Vitrina: clasificación final de cada temporada de la liga (campeones, récords y vitrina de pilotos).
create or replace function public.league_hall(p_league uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare l record; sn int; i int; a date; b date; out jsonb := '[]'::jsonb; st jsonb;
begin
  if auth.uid() is null or not public.is_league_member(p_league, auth.uid()) then return out; end if;
  select * into l from public.leagues where id = p_league;
  sn := floor((public.daily_today() - l.start_day)::numeric / l.season_days)::int;
  for i in 0..sn loop
    a := l.start_day + i * l.season_days; b := a + l.season_days - 1;
    select coalesce(jsonb_agg(jsonb_build_object('u', x.user_id, 'n', p.username, 'h', p.helmet, 'f', p.flag, 'pts', x.pts, 'w', x.wins, 'p', x.podiums, 'd', x.days, 'b', x.best, 'pos', x.pos) order by x.pos), '[]'::jsonb) into st
    from (select q.*, rank() over (order by q.pts desc, q.wins desc, q.best asc nulls last)::int pos from public.league_points(p_league, a, b) q where q.days > 0) x
    join public.profiles p on p.user_id = x.user_id;
    if jsonb_array_length(st) > 0 then out := out || jsonb_build_object('s', i + 1, 'a', a, 'b', b, 'live', i = sn, 'st', st); end if;
  end loop;
  return out;
end $$;

-- league_state: incluye 'gh' (hay repetición) en cada fila de día.
create or replace function public.league_state(p_league uuid, p_season integer default null) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare l public.leagues; cur int; sn int; a date; b date; t date := public.daily_today();
begin
  if not public.is_league_member(p_league, auth.uid()) then raise exception 'No perteneces a esta liga'; end if;
  select * into l from public.leagues where id = p_league;
  cur := floor((t - l.start_day)::numeric / l.season_days)::int; sn := least(greatest(coalesce(p_season - 1, cur), 0), cur);
  a := l.start_day + sn * l.season_days; b := a + l.season_days - 1;
  return jsonb_build_object(
    'league', jsonb_build_object('id', l.id, 'name', l.name, 'code', l.code, 'owner', l.owner, 'season', sn + 1, 'current', cur + 1, 'from', a, 'to', b, 'today', t, 'season_days', l.season_days),
    'lentorro', public.league_lentorro(l.id), 'sanctions', (select coalesce(jsonb_agg(jsonb_build_object('id', sa.id, 'user_id', sa.user_id, 'driver', coalesce(sa.driver, ''), 'points', sa.points, 'day', sa.day) order by sa.day, sa.created_at), '[]'::jsonb) from public.sanctions sa where sa.league_id = l.id and sa.day between a and b),
    'pred', jsonb_build_object('pick', (select pick from public.league_predictions where league_id = l.id and day = t and user_id = auth.uid()),
      'can', not exists (select 1 from public.daily_results where player_id = auth.uid() and day = t)),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.user_id, 'username', p.username, 'flag', p.flag, 'helmet', p.helmet, 'streak', public.user_streak(p.user_id),
        'ghost', exists (select 1 from public.daily_results r where r.day = t and r.player_id = p.user_id and r.ghost is not null)) order by m.joined_at), '[]'::jsonb)
      from public.league_members m join public.profiles p on p.user_id = m.user_id where m.league_id = l.id),
    'standings', (select coalesce(jsonb_agg(to_jsonb(s) order by s.pts desc, s.wins desc, s.best asc nulls last), '[]'::jsonb) from public.league_points(l.id, a, least(b, t)) s),
    'days', (select coalesce(jsonb_agg(d order by d->>'day' desc), '[]'::jsonb) from (
      select jsonb_build_object('day', r.day, 'track', max(r.track_id), 'car', max(r.car_id), 'rows', jsonb_agg(jsonb_build_object('user_id', r.player_id, 'ms', r.lap_ms, 's1', r.s1, 's2', r.s2, 's3', r.s3, 'gh', r.ghost is not null,
        'attempts', (select coalesce(jsonb_agg(at.lap_ms order by at.n), '[]'::jsonb) from public.daily_attempts at where at.day = r.day and at.player_id = r.player_id)) order by r.lap_ms)) d
      from public.daily_results r join public.league_members m on m.user_id = r.player_id and m.league_id = l.id
      where r.day between a and least(b, t) group by r.day) q));
end $$;

-- my_leagues: añade 'today_n' (pilotos que ya han corrido hoy) y 'top' (podio con cascos) para la tarjeta del inicio.
create or replace function public.my_leagues() returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare out jsonb := '[]'::jsonb; l record; sn int; a date; b date; r jsonb; lastj jsonb; pa date; pb date; cnt int;
begin
  if auth.uid() is null then return out; end if;
  for l in select g.* from public.leagues g join public.league_members m on m.league_id = g.id and m.user_id = auth.uid() order by m.joined_at loop
    sn := floor((public.daily_today() - l.start_day)::numeric / l.season_days)::int; a := l.start_day + sn * l.season_days; b := a + l.season_days - 1;
    select jsonb_build_object('pts', x.pts, 'pos', x.pos) into r from (select user_id, pts, rank() over (order by pts desc, wins desc, best asc nulls last)::int pos from public.league_points(l.id, a, b)) x where x.user_id = auth.uid();
    lastj := null;
    if sn >= 1 then
      pa := l.start_day + (sn - 1) * l.season_days; pb := pa + l.season_days - 1;
      select count(*) into cnt from public.league_points(l.id, pa, pb) where days > 0;
      if cnt >= 2 then
        select jsonb_build_object('season', sn, 'players', cnt,
          'champion', (select p.username from (select s.user_id, rank() over (order by s.pts desc, s.wins desc, s.best asc nulls last)::int pos from public.league_points(l.id, pa, pb) s where s.days > 0) q join public.profiles p on p.user_id = q.user_id where q.pos = 1 limit 1),
          'me', (select q.pos from (select s.user_id, rank() over (order by s.pts desc, s.wins desc, s.best asc nulls last)::int pos from public.league_points(l.id, pa, pb) s where s.days > 0) q where q.user_id = auth.uid())) into lastj;
      end if;
    end if;
    out := out || jsonb_build_object('id', l.id, 'name', l.name, 'code', l.code, 'season', sn + 1,
      'members', (select count(*) from public.league_members where league_id = l.id), 'pts', coalesce(r->'pts','0'::jsonb), 'pos', r->'pos', 'last', lastj, 'day', (public.daily_today() - a + 1), 'days', l.season_days, 'ran', exists (select 1 from public.daily_results where player_id = auth.uid() and day = public.daily_today()),
      'today_n', (select count(*) from public.daily_results d join public.league_members mm on mm.user_id = d.player_id and mm.league_id = l.id where d.day = public.daily_today()),
      'top', (select coalesce(jsonb_agg(jsonb_build_object('u', t.username, 'h', t.helmet, 'pts', t.pts, 'me', t.user_id = auth.uid()) order by t.rn), '[]'::jsonb) from (
        select q.user_id, q.pts, p.username, p.helmet, row_number() over (order by q.pts desc, q.wins desc, q.best asc nulls last) rn from public.league_points(l.id, a, b) q join public.profiles p on p.user_id = q.user_id) t where t.rn <= 3));
  end loop;
  return out;
end $$;

grant execute on function public.league_day_ghosts(uuid, date, uuid), public.league_hall(uuid), public.league_state(uuid, int), public.my_leagues() to authenticated;

-- Tareas programadas (requiere pg_cron).
select cron.unschedule(jobid) from cron.job where jobname in ('replay-clean', 'league-newday');
select cron.schedule('replay-clean', '40 5 * * *', 'select public.purge_old_replays()');
select cron.schedule('league-newday', '*/5 * * * *', 'select public.league_newday_post()');
