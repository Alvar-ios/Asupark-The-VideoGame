-- Reto del día: el día cambia a las 4:00 (hora de Madrid). Intentos y resultados se controlan en el servidor.
create table if not exists public.daily_state (
  day date not null, player_id uuid not null,
  practice_runs int not null default 0, practice_ads int not null default 0,
  official_runs int not null default 0, official_ads int not null default 0,
  primary key (day, player_id)
);
create table if not exists public.daily_results (
  day date not null, player_id uuid not null,
  name text not null, flag text, helmet text, car_id text, track_id text,
  lap_ms int not null check (lap_ms between 8000 and 900000),
  s1 int, s2 int, s3 int, updated_at timestamptz not null default now(),
  primary key (day, player_id)
);
create index if not exists daily_results_idx on public.daily_results (day, lap_ms);
alter table public.daily_state enable row level security;
alter table public.daily_results enable row level security;

create or replace function public.daily_today() returns date language sql stable as $$
  select (timezone('Europe/Madrid', now()) - interval '4 hours')::date $$;

create or replace function public.daily_status(p_player uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.daily_state; r public.daily_results;
begin
  select * into s from public.daily_state where day = public.daily_today() and player_id = p_player;
  select * into r from public.daily_results where day = public.daily_today() and player_id = p_player;
  return jsonb_build_object('day', public.daily_today(), 'pr', coalesce(s.practice_runs,0), 'pa', coalesce(s.practice_ads,0),
    'or', coalesce(s.official_runs,0), 'oa', coalesce(s.official_ads,0), 'ms', r.lap_ms, 's1', r.s1, 's2', r.s2, 's3', r.s3);
end $$;

-- p_kind: 'practice' | 'official'. Permite 1 sesión + 1 extra (tras anuncio). Devuelve false si no quedan.
create or replace function public.daily_begin(p_player uuid, p_kind text) returns boolean language plpgsql security definer set search_path = public as $$
declare s public.daily_state;
begin
  if p_kind not in ('practice','official') then raise exception 'tipo no válido'; end if;
  insert into public.daily_state(day, player_id) values (public.daily_today(), p_player) on conflict do nothing;
  select * into s from public.daily_state where day = public.daily_today() and player_id = p_player for update;
  if p_kind = 'practice' then
    if s.practice_runs >= 1 + s.practice_ads then return false; end if;
    update public.daily_state set practice_runs = practice_runs + 1 where day = s.day and player_id = p_player;
  else
    if s.official_runs >= 1 + s.official_ads then return false; end if;
    update public.daily_state set official_runs = official_runs + 1 where day = s.day and player_id = p_player;
  end if;
  return true;
end $$;

-- Anuncio visto: concede UNA sesión extra por tipo, solo cuando ya se ha usado la primera.
create or replace function public.daily_ad(p_player uuid, p_kind text) returns boolean language plpgsql security definer set search_path = public as $$
declare s public.daily_state;
begin
  insert into public.daily_state(day, player_id) values (public.daily_today(), p_player) on conflict do nothing;
  select * into s from public.daily_state where day = public.daily_today() and player_id = p_player for update;
  if p_kind = 'practice' then
    if s.practice_ads >= 1 or s.practice_runs < 1 then return false; end if;
    update public.daily_state set practice_ads = 1 where day = s.day and player_id = p_player;
  elsif p_kind = 'official' then
    if s.official_ads >= 1 or s.official_runs < 1 then return false; end if;
    update public.daily_state set official_ads = 1 where day = s.day and player_id = p_player;
  else raise exception 'tipo no válido'; end if;
  return true;
end $$;

create or replace function public.daily_submit(p_player uuid, p_name text, p_flag text, p_helmet text, p_car text, p_track text, p_ms int, p_s1 int, p_s2 int, p_s3 int)
returns void language plpgsql security definer set search_path = public as $$
declare s public.daily_state;
begin
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(p_name) > 20 then raise exception 'nombre no válido'; end if;
  if p_ms is null or p_ms < 8000 or p_ms > 900000 then raise exception 'tiempo no válido'; end if;
  select * into s from public.daily_state where day = public.daily_today() and player_id = p_player;
  if s.official_runs is null or s.official_runs < 1 then raise exception 'sin sesión oficial'; end if;
  insert into public.daily_results(day, player_id, name, flag, helmet, car_id, track_id, lap_ms, s1, s2, s3)
  values (public.daily_today(), p_player, trim(p_name), left(p_flag,2), left(p_helmet,40), left(p_car,20), left(p_track,60), p_ms, p_s1, p_s2, p_s3)
  on conflict (day, player_id) do update set
    lap_ms = excluded.lap_ms, s1 = excluded.s1, s2 = excluded.s2, s3 = excluded.s3, updated_at = now(), name = excluded.name, flag = excluded.flag, helmet = excluded.helmet
    where excluded.lap_ms < public.daily_results.lap_ms;
end $$;

create or replace function public.daily_board(p_ids uuid[] default null) returns table (player_id uuid, name text, flag text, helmet text, car_id text, lap_ms int, s1 int, s2 int, s3 int)
language sql stable security definer set search_path = public as $$
  select player_id, name, flag, helmet, car_id, lap_ms, s1, s2, s3 from public.daily_results
  where day = public.daily_today() and (p_ids is null or player_id = any(p_ids)) order by lap_ms asc limit 200 $$;

revoke all on function public.daily_today(), public.daily_status(uuid), public.daily_begin(uuid,text), public.daily_ad(uuid,text),
  public.daily_submit(uuid,text,text,text,text,text,int,int,int,int), public.daily_board(uuid[]) from public;
grant execute on function public.daily_today(), public.daily_status(uuid), public.daily_begin(uuid,text), public.daily_ad(uuid,text),
  public.daily_submit(uuid,text,text,text,text,text,int,int,int,int), public.daily_board(uuid[]) to anon, authenticated;
