-- Ligas de amigos: temporadas de 14 días con puntos de F1 sobre el reto diario, intentos por día y chat.
create table if not exists public.daily_attempts (
  day date not null, player_id uuid not null, n int not null,
  lap_ms int not null check (lap_ms between 8000 and 900000), s1 int, s2 int, s3 int, car_id text, track_id text,
  created_at timestamptz not null default now(), primary key (day, player_id, n)
);
create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 30),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  owner uuid not null references public.profiles(user_id) on delete cascade,
  start_day date not null, season_days int not null default 14 check (season_days between 3 and 60),
  created_at timestamptz not null default now()
);
create table if not exists public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  joined_at timestamptz not null default now(), primary key (league_id, user_id)
);
create index if not exists league_members_user on public.league_members (user_id);
create table if not exists public.league_messages (
  id bigint generated always as identity primary key,
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists league_messages_idx on public.league_messages (league_id, id);
alter table public.daily_attempts enable row level security; alter table public.leagues enable row level security;
alter table public.league_members enable row level security; alter table public.league_messages enable row level security;

-- cada sesión oficial deja su intento (el reto diario ya sólo guardaba el mejor tiempo)
create or replace function public.daily_submit(p_player uuid, p_name text, p_flag text, p_helmet text, p_car text, p_track text, p_ms int, p_s1 int, p_s2 int, p_s3 int)
returns void language plpgsql security definer set search_path = public as $$
declare s public.daily_state;
begin
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(p_name) > 20 then raise exception 'nombre no válido'; end if;
  if p_ms is null or p_ms < 8000 or p_ms > 900000 then raise exception 'tiempo no válido'; end if;
  select * into s from public.daily_state where day = public.daily_today() and player_id = p_player;
  if s.official_runs is null or s.official_runs < 1 then raise exception 'sin sesión oficial'; end if;
  insert into public.daily_attempts(day, player_id, n, lap_ms, s1, s2, s3, car_id, track_id)
  values (public.daily_today(), p_player, s.official_runs, p_ms, p_s1, p_s2, p_s3, left(p_car,20), left(p_track,60))
  on conflict (day, player_id, n) do update set lap_ms = excluded.lap_ms, s1 = excluded.s1, s2 = excluded.s2, s3 = excluded.s3 where excluded.lap_ms < public.daily_attempts.lap_ms;
  insert into public.daily_results(day, player_id, name, flag, helmet, car_id, track_id, lap_ms, s1, s2, s3)
  values (public.daily_today(), p_player, trim(p_name), left(p_flag,2), left(p_helmet,40), left(p_car,20), left(p_track,60), p_ms, p_s1, p_s2, p_s3)
  on conflict (day, player_id) do update set
    lap_ms = excluded.lap_ms, s1 = excluded.s1, s2 = excluded.s2, s3 = excluded.s3, updated_at = now(), name = excluded.name, flag = excluded.flag, helmet = excluded.helmet
    where excluded.lap_ms < public.daily_results.lap_ms;
end $$;

create or replace function public.is_league_member(p_league uuid, p_user uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.league_members where league_id = p_league and user_id = p_user) $$;

-- puntos de F1 (25-18-15-12-10-8-6-4-2-1) por día entre los miembros que han marcado tiempo
create or replace function public.league_points(p_league uuid, p_from date, p_to date)
returns table (user_id uuid, pts int, wins int, podiums int, days int, best int) language sql stable security definer set search_path = public as $$
  with res as (
    select r.day, r.player_id, r.lap_ms, rank() over (partition by r.day order by r.lap_ms) rk
    from public.daily_results r join public.league_members m on m.user_id = r.player_id and m.league_id = p_league
    where r.day between p_from and p_to)
  select m.user_id, coalesce(sum(case when rk <= 10 then (array[25,18,15,12,10,8,6,4,2,1])[rk::int] else 0 end),0)::int,
    count(*) filter (where rk = 1)::int, count(*) filter (where rk <= 3)::int, count(res.day)::int, min(lap_ms)::int
  from public.league_members m left join res on res.player_id = m.user_id where m.league_id = p_league group by m.user_id $$;

create or replace function public.league_create(p_name text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text; i int := 0; lid uuid; chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(trim(p_name)) > 30 then raise exception 'El nombre necesita 2-30 caracteres'; end if;
  if (select count(*) from public.league_members where user_id = auth.uid()) >= 10 then raise exception 'Máximo 10 ligas'; end if;
  loop
    c := ''; for k in 1..6 loop c := c || substr(chars, 1 + floor(random()*32)::int, 1); end loop;
    exit when not exists (select 1 from public.leagues where code = c); i := i + 1; if i > 20 then raise exception 'Reinténtalo'; end if;
  end loop;
  insert into public.leagues(name, code, owner, start_day) values (trim(p_name), c, auth.uid(), public.daily_today()) returning id into lid;
  insert into public.league_members(league_id, user_id) values (lid, auth.uid());
  return jsonb_build_object('id', lid, 'code', c);
end $$;

create or replace function public.league_preview(p_code text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', l.id, 'name', l.name, 'owner', (select username from public.profiles where user_id = l.owner),
    'members', (select count(*) from public.league_members where league_id = l.id)) from public.leagues l where l.code = upper(trim(p_code)) $$;

create or replace function public.league_join(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare l public.leagues;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into l from public.leagues where code = upper(trim(p_code));
  if l.id is null then raise exception 'Código de liga no válido'; end if;
  if (select count(*) from public.league_members where league_id = l.id) >= 30 and not public.is_league_member(l.id, auth.uid()) then raise exception 'La liga está llena (30 pilotos)'; end if;
  if (select count(*) from public.league_members where user_id = auth.uid()) >= 10 and not public.is_league_member(l.id, auth.uid()) then raise exception 'Máximo 10 ligas'; end if;
  insert into public.league_members(league_id, user_id) values (l.id, auth.uid()) on conflict do nothing;
  return jsonb_build_object('id', l.id, 'name', l.name);
end $$;

create or replace function public.league_leave(p_league uuid) returns void language plpgsql security definer set search_path = public as $$
declare nxt uuid;
begin
  delete from public.league_members where league_id = p_league and user_id = auth.uid();
  if not exists (select 1 from public.league_members where league_id = p_league) then delete from public.leagues where id = p_league; return; end if;
  if (select owner from public.leagues where id = p_league) = auth.uid() then
    select user_id into nxt from public.league_members where league_id = p_league order by joined_at limit 1;
    update public.leagues set owner = nxt where id = p_league;
  end if;
end $$;

create or replace function public.my_leagues() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare out jsonb := '[]'::jsonb; l record; sn int; a date; b date; r jsonb; pos int;
begin
  if auth.uid() is null then return out; end if;
  for l in select g.* from public.leagues g join public.league_members m on m.league_id = g.id and m.user_id = auth.uid() order by m.joined_at loop
    sn := floor((public.daily_today() - l.start_day)::numeric / l.season_days)::int; a := l.start_day + sn * l.season_days; b := a + l.season_days - 1;
    select jsonb_build_object('pts', x.pts, 'pos', x.pos) into r from (select user_id, pts, rank() over (order by pts desc, wins desc, best asc nulls last)::int pos from public.league_points(l.id, a, b)) x where x.user_id = auth.uid();
    out := out || jsonb_build_object('id', l.id, 'name', l.name, 'code', l.code, 'season', sn + 1,
      'members', (select count(*) from public.league_members where league_id = l.id), 'pts', coalesce(r->'pts','0'::jsonb), 'pos', r->'pos');
  end loop;
  return out;
end $$;

create or replace function public.league_state(p_league uuid, p_season int default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare l public.leagues; cur int; sn int; a date; b date; t date := public.daily_today();
begin
  if not public.is_league_member(p_league, auth.uid()) then raise exception 'No perteneces a esta liga'; end if;
  select * into l from public.leagues where id = p_league;
  cur := floor((t - l.start_day)::numeric / l.season_days)::int; sn := least(greatest(coalesce(p_season - 1, cur), 0), cur);
  a := l.start_day + sn * l.season_days; b := a + l.season_days - 1;
  return jsonb_build_object(
    'league', jsonb_build_object('id', l.id, 'name', l.name, 'code', l.code, 'owner', l.owner, 'season', sn + 1, 'current', cur + 1, 'from', a, 'to', b, 'today', t, 'season_days', l.season_days),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.user_id, 'username', p.username, 'flag', p.flag, 'helmet', p.helmet) order by m.joined_at), '[]'::jsonb)
      from public.league_members m join public.profiles p on p.user_id = m.user_id where m.league_id = l.id),
    'standings', (select coalesce(jsonb_agg(to_jsonb(s) order by s.pts desc, s.wins desc, s.best asc nulls last), '[]'::jsonb) from public.league_points(l.id, a, least(b, t)) s),
    'days', (select coalesce(jsonb_agg(d order by d->>'day' desc), '[]'::jsonb) from (
      select jsonb_build_object('day', r.day, 'track', max(r.track_id), 'car', max(r.car_id), 'rows', jsonb_agg(jsonb_build_object('user_id', r.player_id, 'ms', r.lap_ms, 's1', r.s1, 's2', r.s2, 's3', r.s3,
        'attempts', (select coalesce(jsonb_agg(at.lap_ms order by at.n), '[]'::jsonb) from public.daily_attempts at where at.day = r.day and at.player_id = r.player_id)) order by r.lap_ms)) d
      from public.daily_results r join public.league_members m on m.user_id = r.player_id and m.league_id = l.id
      where r.day between a and least(b, t) group by r.day) q));
end $$;

create or replace function public.league_post(p_league uuid, p_body text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_league_member(p_league, auth.uid()) then raise exception 'No perteneces a esta liga'; end if;
  p_body := trim(p_body); if p_body is null or char_length(p_body) = 0 then return; end if;
  if exists (select 1 from public.league_messages where user_id = auth.uid() and created_at > now() - interval '700 milliseconds') then raise exception 'Más despacio'; end if;
  insert into public.league_messages(league_id, user_id, body) values (p_league, auth.uid(), left(p_body, 300));
end $$;

create or replace function public.league_chat(p_league uuid, p_after bigint default 0) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_league_member(p_league, auth.uid()) then raise exception 'No perteneces a esta liga'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'user_id', x.user_id, 'username', x.username, 'body', x.body, 'at', x.created_at) order by x.id), '[]'::jsonb) from (
    select m.id, m.user_id, p.username, m.body, m.created_at from public.league_messages m join public.profiles p on p.user_id = m.user_id
    where m.league_id = p_league and m.id > p_after order by m.id desc limit 60) x);
end $$;

revoke all on function public.is_league_member(uuid,uuid), public.league_points(uuid,date,date), public.league_create(text), public.league_preview(text), public.league_join(text), public.league_leave(uuid),
  public.my_leagues(), public.league_state(uuid,int), public.league_post(uuid,text), public.league_chat(uuid,bigint) from public, anon, authenticated;
grant execute on function public.league_preview(text) to anon, authenticated;
grant execute on function public.league_create(text), public.league_join(text), public.league_leave(uuid), public.my_leagues(), public.league_state(uuid,int), public.league_post(uuid,text), public.league_chat(uuid,bigint) to authenticated;

-- Lentorro: el jugador con menos puntos de la temporada (hasta ayer) en la liga, siempre que ayer haya jugado.
create or replace function public.league_lentorro(p_league uuid) returns uuid language plpgsql stable security definer set search_path = public as $$
declare l public.leagues; y date := public.daily_today() - 1; sn int; a date; u uuid;
begin
  select * into l from public.leagues where id = p_league;
  if l.id is null or y < l.start_day then return null; end if;
  if (select count(*) from public.league_members where league_id = p_league) < 2 then return null; end if;
  sn := floor((y - l.start_day)::numeric / l.season_days)::int; a := l.start_day + sn * l.season_days;
  select s.user_id into u from public.league_points(p_league, a, y) s
    left join public.daily_results r on r.day = y and r.player_id = s.user_id
    order by s.pts asc, (r.player_id is not null) asc, r.lap_ms desc nulls last, s.user_id limit 1;
  if u is null or not exists (select 1 from public.daily_results where day = y and player_id = u) then return null; end if;
  return u;
end $$;
create or replace function public.daily_underdog() returns jsonb language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then null else (
    select jsonb_agg(l.name) from public.leagues l join public.league_members m on m.league_id = l.id and m.user_id = auth.uid()
    where public.league_lentorro(l.id) = auth.uid()) end $$;
-- (league_state devuelve además 'lentorro': el user_id; ver la migración lentorro_by_points)
revoke all on function public.league_lentorro(uuid), public.daily_underdog() from public, anon, authenticated;
grant execute on function public.daily_underdog() to authenticated;
