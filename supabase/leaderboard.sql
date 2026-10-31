-- Clasificaciones de Drift Rush. Ejecutar una vez en el proyecto de Supabase que use el juego.
-- Lectura pública; la escritura solo es posible a través de submit_lap (que conserva el mejor tiempo).
create table if not exists public.lap_times (
  player_id  uuid        not null,
  name       text        not null check (char_length(name) between 2 and 20),
  track_id   text        not null,          -- 'pruebas', 'monaco', 'spa'... o 'daily:daily-YYYY-MM-DD'
  car_id     text        not null check (char_length(car_id) between 2 and 20),
  lap_ms     integer     not null check (lap_ms between 8000 and 900000),
  updated_at timestamptz not null default now(),
  primary key (player_id, track_id, car_id)
);
create index if not exists lap_times_track_idx on public.lap_times (track_id, lap_ms);
alter table public.lap_times enable row level security;
drop policy if exists "lectura publica" on public.lap_times;
create policy "lectura publica" on public.lap_times for select to anon, authenticated using (true);

create or replace function public.submit_lap(p_player uuid, p_name text, p_track text, p_car text, p_ms integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(p_name) > 20 then raise exception 'nombre no válido'; end if;
  if p_ms is null or p_ms < 8000 or p_ms > 900000 then raise exception 'tiempo no válido'; end if;
  if p_track is null or char_length(p_track) > 60 or p_car is null or char_length(p_car) > 20 then raise exception 'datos no válidos'; end if;
  insert into public.lap_times (player_id, name, track_id, car_id, lap_ms)
  values (p_player, trim(p_name), p_track, p_car, p_ms)
  on conflict (player_id, track_id, car_id) do update
    set lap_ms = least(public.lap_times.lap_ms, excluded.lap_ms), name = excluded.name, updated_at = now();
  update public.lap_times set name = trim(p_name) where player_id = p_player and name <> trim(p_name);
end $$;
revoke all on function public.submit_lap(uuid, text, text, text, integer) from public;
grant execute on function public.submit_lap(uuid, text, text, text, integer) to anon, authenticated;
