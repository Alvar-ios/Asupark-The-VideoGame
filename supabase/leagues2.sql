-- Ligas v2: racha, resumen del día, chat con reacciones y mensajes automáticos, predicciones, fantasma del reto, trofeos de temporada.
alter table public.daily_results add column if not exists ghost jsonb;
alter table public.league_messages add column if not exists kind text not null default 'msg';
alter table public.league_messages drop constraint if exists league_messages_kind_chk;
alter table public.league_messages add constraint league_messages_kind_chk check (kind in ('msg','sys'));
create table if not exists public.league_reactions (
  msg_id bigint not null references public.league_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  emoji text not null check (emoji in ('🔥','😂','🐌','👏','😱')),
  primary key (msg_id, user_id, emoji));
create table if not exists public.league_predictions (
  league_id uuid not null references public.leagues(id) on delete cascade,
  day date not null,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  pick uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(), primary key (league_id, day, user_id));
alter table public.league_reactions enable row level security;
alter table public.league_predictions enable row level security;

create or replace function public.fmt_ms(p_ms int) returns text language sql immutable as $$
  select (p_ms / 60000)::text || ':' || lpad(((p_ms / 1000) % 60)::text, 2, '0') || '.' || lpad(((p_ms % 1000) / 10)::text, 2, '0') $$;

-- racha: días seguidos con tiempo en el reto (cuenta hasta hoy, o hasta ayer si hoy aún no has corrido)
create or replace function public.user_streak(p_user uuid) returns int language sql stable security definer set search_path = public as $$
  with d as (select distinct day from public.daily_results where player_id = p_user and day <= public.daily_today()),
  g as (select day, day - (row_number() over (order by day))::int as grp from d)
  select coalesce((select count(*)::int from g where grp = (select grp from g where day >= public.daily_today() - 1 order by day desc limit 1)), 0) $$;
create or replace function public.my_streak() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('streak', public.user_streak(auth.uid()),
    'today', exists (select 1 from public.daily_results where player_id = auth.uid() and day = public.daily_today()),
    'best', coalesce((select max(c) from (select count(*) c from (select day, day - (row_number() over (order by day))::int grp from (select distinct day from public.daily_results where player_id = auth.uid()) x) y group by grp) z), 0)) $$;

-- puntos F1 + bonus por predicciones acertadas (solo de días ya cerrados)
drop function if exists public.league_points(uuid, date, date);
create or replace function public.league_points(p_league uuid, p_from date, p_to date)
returns table (user_id uuid, pts int, wins int, podiums int, days int, best int, bonus int) language sql stable security definer set search_path = public as $$
  with res as (
    select r.day, r.player_id, r.lap_ms, rank() over (partition by r.day order by r.lap_ms) rk
    from public.daily_results r join public.league_members m on m.user_id = r.player_id and m.league_id = p_league
    where r.day between p_from and p_to),
  hits as (select lp.user_id, count(*)::int n from public.league_predictions lp join res on res.day = lp.day and res.player_id = lp.pick and res.rk = 1
    where lp.league_id = p_league and lp.day between p_from and p_to and lp.day < public.daily_today() group by lp.user_id)
  select m.user_id,
    (coalesce(sum(case when rk <= 10 then (array[25,18,15,12,10,8,6,4,2,1])[rk::int] else 0 end),0) + coalesce(max(h.n),0))::int,
    count(*) filter (where rk = 1)::int, count(*) filter (where rk <= 3)::int, count(res.day)::int, min(lap_ms)::int, coalesce(max(h.n),0)::int
  from public.league_members m left join res on res.player_id = m.user_id left join hits h on h.user_id = m.user_id
  where m.league_id = p_league group by m.user_id $$;

-- predicción: quién gana hoy (se cierra cuando corres tú; +1 punto si aciertas)
create or replace function public.league_predict(p_league uuid, p_pick uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_league_member(p_league, auth.uid()) then raise exception 'No perteneces a esta liga'; end if;
  if not public.is_league_member(p_league, p_pick) then raise exception 'Ese piloto no está en la liga'; end if;
  if exists (select 1 from public.daily_results where player_id = auth.uid() and day = public.daily_today()) then raise exception 'La predicción se cierra cuando corres'; end if;
  if exists (select 1 from public.league_predictions where league_id = p_league and day = public.daily_today() and user_id = auth.uid()) then raise exception 'Ya has apostado hoy'; end if;
  insert into public.league_predictions(league_id, day, user_id, pick) values (p_league, public.daily_today(), auth.uid(), p_pick);
end $$;

-- chat: mensajes de la ventana reciente con reacciones; los mensajes automáticos llevan kind = 'sys'
create or replace function public.league_chat(p_league uuid, p_after bigint default 0) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_league_member(p_league, auth.uid()) then raise exception 'No perteneces a esta liga'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'user_id', x.user_id, 'username', x.username, 'body', x.body, 'kind', x.kind, 'at', x.created_at,
      'rx', (select coalesce(jsonb_object_agg(e.emoji, jsonb_build_object('n', e.n, 'me', e.me)), '{}'::jsonb) from (
        select r.emoji, count(*)::int n, bool_or(r.user_id = auth.uid()) me from public.league_reactions r where r.msg_id = x.id group by r.emoji) e)) order by x.id), '[]'::jsonb) from (
    select m.id, m.user_id, p.username, m.body, m.kind, m.created_at from public.league_messages m join public.profiles p on p.user_id = m.user_id
    where m.league_id = p_league order by m.id desc limit 60) x);
end $$;
create or replace function public.league_react(p_msg bigint, p_emoji text) returns void language plpgsql security definer set search_path = public as $$
declare lid uuid;
begin
  select league_id into lid from public.league_messages where id = p_msg;
  if lid is null or not public.is_league_member(lid, auth.uid()) then raise exception 'No perteneces a esta liga'; end if;
  if exists (select 1 from public.league_reactions where msg_id = p_msg and user_id = auth.uid() and emoji = p_emoji) then
    delete from public.league_reactions where msg_id = p_msg and user_id = auth.uid() and emoji = p_emoji;
  else insert into public.league_reactions(msg_id, user_id, emoji) values (p_msg, auth.uid(), p_emoji); end if;
end $$;

-- el reto guarda también el fantasma de la mejor vuelta oficial y avisa en el chat de cada liga cuando alguien se pone líder
drop function if exists public.daily_submit(uuid, text, text, text, text, text, int, int, int, int);
create or replace function public.daily_submit(p_player uuid, p_name text, p_flag text, p_helmet text, p_car text, p_track text, p_ms int, p_s1 int, p_s2 int, p_s3 int, p_ghost jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare s public.daily_state; prev int; g jsonb := null; l record; lead_id uuid; nm text; pos int; n int;
begin
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(p_name) > 20 then raise exception 'nombre no válido'; end if;
  if p_ms is null or p_ms < 8000 or p_ms > 900000 then raise exception 'tiempo no válido'; end if;
  select * into s from public.daily_state where day = public.daily_today() and player_id = p_player;
  if s.official_runs is null or s.official_runs < 1 then raise exception 'sin sesión oficial'; end if;
  if p_ghost is not null and jsonb_typeof(p_ghost) = 'array' and jsonb_array_length(p_ghost) between 8 and 40000 and jsonb_array_length(p_ghost) % 4 = 0 then g := p_ghost; end if;
  select lap_ms into prev from public.daily_results where day = public.daily_today() and player_id = p_player;
  insert into public.daily_attempts(day, player_id, n, lap_ms, s1, s2, s3, car_id, track_id)
  values (public.daily_today(), p_player, s.official_runs, p_ms, p_s1, p_s2, p_s3, left(p_car,20), left(p_track,60))
  on conflict (day, player_id, n) do update set lap_ms = excluded.lap_ms, s1 = excluded.s1, s2 = excluded.s2, s3 = excluded.s3 where excluded.lap_ms < public.daily_attempts.lap_ms;
  insert into public.daily_results(day, player_id, name, flag, helmet, car_id, track_id, lap_ms, s1, s2, s3, ghost)
  values (public.daily_today(), p_player, trim(p_name), left(p_flag,2), left(p_helmet,40), left(p_car,20), left(p_track,60), p_ms, p_s1, p_s2, p_s3, g)
  on conflict (day, player_id) do update set
    lap_ms = excluded.lap_ms, s1 = excluded.s1, s2 = excluded.s2, s3 = excluded.s3, ghost = excluded.ghost, updated_at = now(), name = excluded.name, flag = excluded.flag, helmet = excluded.helmet
    where excluded.lap_ms < public.daily_results.lap_ms;
  if prev is null or p_ms < prev then
    select coalesce((select username from public.profiles where user_id = p_player), trim(p_name)) into nm;
    for l in select m.league_id from public.league_members m where m.user_id = p_player loop
      select r.player_id into lead_id from public.daily_results r join public.league_members mm on mm.user_id = r.player_id and mm.league_id = l.league_id
        where r.day = public.daily_today() order by r.lap_ms, r.updated_at limit 1;
      select count(*) into n from public.daily_results r join public.league_members mm on mm.user_id = r.player_id and mm.league_id = l.league_id where r.day = public.daily_today();
      if lead_id = p_player and n >= 2 then
        insert into public.league_messages(league_id, user_id, body, kind) values (l.league_id, p_player, '🏁 @' || nm || ' marca ' || public.fmt_ms(p_ms) || ' y se pone líder del día', 'sys');
      elsif prev is null then
        select count(*) + 1 into pos from public.daily_results r join public.league_members mm on mm.user_id = r.player_id and mm.league_id = l.league_id where r.day = public.daily_today() and r.lap_ms < p_ms and r.player_id <> p_player;
        insert into public.league_messages(league_id, user_id, body, kind) values (l.league_id, p_player, '⏱️ @' || nm || ' ya ha corrido hoy: ' || public.fmt_ms(p_ms) || ' (P' || pos || ')', 'sys');
      end if;
    end loop;
  end if;
end $$;

-- fantasma de un compañero de liga (solo el de hoy, que es el circuito y coche de todos)
create or replace function public.daily_ghost(p_player uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r public.daily_results;
begin
  if auth.uid() is null or not exists (select 1 from public.league_members a join public.league_members b on a.league_id = b.league_id where a.user_id = auth.uid() and b.user_id = p_player) then raise exception 'No compartís liga'; end if;
  select * into r from public.daily_results where day = public.daily_today() and player_id = p_player;
  if r.ghost is null then return null; end if;
  return jsonb_build_object('name', (select username from public.profiles where user_id = p_player), 'ms', r.lap_ms, 'car', r.car_id, 'ghost', r.ghost);
end $$;

-- resumen de ayer en la liga
create or replace function public.league_recap(p_league uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare l public.leagues; y date := public.daily_today() - 1; sn int; a date; res jsonb;
begin
  if not public.is_league_member(p_league, auth.uid()) then raise exception 'No perteneces a esta liga'; end if;
  select * into l from public.leagues where id = p_league;
  if y < l.start_day then return null; end if;
  sn := floor((y - l.start_day)::numeric / l.season_days)::int; a := l.start_day + sn * l.season_days;
  with day_rows as (select r.player_id, r.lap_ms, rank() over (order by r.lap_ms)::int rk from public.daily_results r join public.league_members m on m.user_id = r.player_id and m.league_id = p_league where r.day = y),
  now_t as (select s.user_id, s.pts, rank() over (order by s.pts desc, s.wins desc, s.best asc nulls last)::int pos from public.league_points(p_league, a, y) s),
  prev_t as (select s.user_id, rank() over (order by s.pts desc, s.wins desc, s.best asc nulls last)::int pos from public.league_points(p_league, a, y - 1) s where y - 1 >= a)
  select case when not exists (select 1 from day_rows) then null else jsonb_build_object(
    'day', y, 'players', (select count(*) from day_rows),
    'winner', (select jsonb_build_object('user_id', d.player_id, 'username', p.username, 'ms', d.lap_ms) from day_rows d join public.profiles p on p.user_id = d.player_id where d.rk = 1 limit 1),
    'second', (select jsonb_build_object('username', p.username, 'gap', d.lap_ms - (select min(lap_ms) from day_rows)) from day_rows d join public.profiles p on p.user_id = d.player_id where d.rk = 2 limit 1),
    'leader', (select jsonb_build_object('username', p.username, 'pts', n.pts) from now_t n join public.profiles p on p.user_id = n.user_id where n.pos = 1 limit 1),
    'climber', (select jsonb_build_object('username', p.username, 'from', pt.pos, 'to', n.pos) from now_t n join prev_t pt on pt.user_id = n.user_id join public.profiles p on p.user_id = n.user_id where pt.pos - n.pos > 0 order by pt.pos - n.pos desc, n.pos limit 1),
    'me', (select jsonb_build_object('pos', d.rk, 'ms', d.lap_ms, 'pts', coalesce((array[25,18,15,12,10,8,6,4,2,1])[d.rk], 0)) from day_rows d where d.player_id = auth.uid()),
    'lentorro', public.league_lentorro(p_league)) end into res;
  return res;
end $$;

-- trofeos: campeón y Lentorro de cada temporada cerrada (mínimo 2 pilotos con tiempo)
create or replace function public.my_trophies() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare out jsonb := '[]'::jsonb; l record; cur int; k int; a date; b date; w record; cnt int;
begin
  if auth.uid() is null then return out; end if;
  for l in select g.* from public.leagues g join public.league_members m on m.league_id = g.id and m.user_id = auth.uid() loop
    cur := floor((public.daily_today() - l.start_day)::numeric / l.season_days)::int;
    for k in 0 .. cur - 1 loop
      a := l.start_day + k * l.season_days; b := a + l.season_days - 1;
      select count(*) into cnt from public.league_points(l.id, a, b) where days > 0;
      if cnt < 2 then continue; end if;
      select x.* into w from (select s.user_id, rank() over (order by s.pts desc, s.wins desc, s.best asc nulls last)::int pos, s.pts from public.league_points(l.id, a, b) s where s.days > 0) x where x.user_id = auth.uid();
      if w.pos = 1 then out := out || jsonb_build_object('kind', 'champion', 'league', l.name, 'season', k + 1, 'pts', w.pts, 'players', cnt);
      elsif w.pos = cnt and cnt >= 3 then out := out || jsonb_build_object('kind', 'lentorro', 'league', l.name, 'season', k + 1, 'pts', w.pts, 'players', cnt); end if;
    end loop;
  end loop;
  return out;
end $$;

-- my_leagues: añade temporada anterior terminada (campeón y mi puesto)
create or replace function public.my_leagues() returns jsonb language plpgsql stable security definer set search_path = public as $$
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
      'members', (select count(*) from public.league_members where league_id = l.id), 'pts', coalesce(r->'pts','0'::jsonb), 'pos', r->'pos', 'last', lastj);
  end loop;
  return out;
end $$;

-- league_state: añade racha de cada miembro, predicción de hoy y bonus en la clasificación (viene de league_points)
create or replace function public.league_state(p_league uuid, p_season int default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare l public.leagues; cur int; sn int; a date; b date; t date := public.daily_today();
begin
  if not public.is_league_member(p_league, auth.uid()) then raise exception 'No perteneces a esta liga'; end if;
  select * into l from public.leagues where id = p_league;
  cur := floor((t - l.start_day)::numeric / l.season_days)::int; sn := least(greatest(coalesce(p_season - 1, cur), 0), cur);
  a := l.start_day + sn * l.season_days; b := a + l.season_days - 1;
  return jsonb_build_object(
    'league', jsonb_build_object('id', l.id, 'name', l.name, 'code', l.code, 'owner', l.owner, 'season', sn + 1, 'current', cur + 1, 'from', a, 'to', b, 'today', t, 'season_days', l.season_days),
    'lentorro', public.league_lentorro(l.id),
    'pred', jsonb_build_object('pick', (select pick from public.league_predictions where league_id = l.id and day = t and user_id = auth.uid()),
      'can', not exists (select 1 from public.daily_results where player_id = auth.uid() and day = t)),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.user_id, 'username', p.username, 'flag', p.flag, 'helmet', p.helmet, 'streak', public.user_streak(p.user_id),
        'ghost', exists (select 1 from public.daily_results r where r.day = t and r.player_id = p.user_id and r.ghost is not null)) order by m.joined_at), '[]'::jsonb)
      from public.league_members m join public.profiles p on p.user_id = m.user_id where m.league_id = l.id),
    'standings', (select coalesce(jsonb_agg(to_jsonb(s) order by s.pts desc, s.wins desc, s.best asc nulls last), '[]'::jsonb) from public.league_points(l.id, a, least(b, t)) s),
    'days', (select coalesce(jsonb_agg(d order by d->>'day' desc), '[]'::jsonb) from (
      select jsonb_build_object('day', r.day, 'track', max(r.track_id), 'car', max(r.car_id), 'rows', jsonb_agg(jsonb_build_object('user_id', r.player_id, 'ms', r.lap_ms, 's1', r.s1, 's2', r.s2, 's3', r.s3,
        'attempts', (select coalesce(jsonb_agg(at.lap_ms order by at.n), '[]'::jsonb) from public.daily_attempts at where at.day = r.day and at.player_id = r.player_id)) order by r.lap_ms)) d
      from public.daily_results r join public.league_members m on m.user_id = r.player_id and m.league_id = l.id
      where r.day between a and least(b, t) group by r.day) q));
end $$;

revoke all on function public.fmt_ms(int), public.user_streak(uuid), public.my_streak(), public.league_points(uuid,date,date), public.league_predict(uuid,uuid), public.league_chat(uuid,bigint), public.league_react(bigint,text),
  public.daily_submit(uuid,text,text,text,text,text,int,int,int,int,jsonb), public.daily_ghost(uuid), public.league_recap(uuid), public.my_trophies(), public.my_leagues(), public.league_state(uuid,int) from public, anon, authenticated;
grant execute on function public.daily_submit(uuid,text,text,text,text,text,int,int,int,int,jsonb) to anon, authenticated;
grant execute on function public.my_streak(), public.league_predict(uuid,uuid), public.league_chat(uuid,bigint), public.league_react(bigint,text), public.daily_ghost(uuid), public.league_recap(uuid), public.my_trophies(), public.my_leagues(), public.league_state(uuid,int) to authenticated;
