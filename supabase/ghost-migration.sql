-- Fantasmas online (dorado = mejor vuelta de la categoría entre todos los jugadores).
-- Garantía: el fantasma guardado en una fila SIEMPRE es el de su tiempo (ghost_ms = lap_ms); si el tiempo mejora sin fantasma, el viejo se borra.
-- Ejecutar en el SQL Editor del proyecto (v2: sustituye a la versión anterior).

alter table public.lap_times add column if not exists ghost jsonb;
alter table public.lap_times add column if not exists ghost_ms integer;

-- Tiempo sin fantasma (cola offline / modos sin grabación): si mejora el tiempo, el fantasma anterior deja de corresponder y se elimina.
create or replace function public.submit_lap(p_player uuid, p_name text, p_track text, p_car text, p_ms integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(p_name) > 20 then raise exception 'nombre no válido'; end if;
  if p_ms is null or p_ms < 8000 or p_ms > 900000 then raise exception 'tiempo no válido'; end if;
  if p_track is null or char_length(p_track) > 60 or p_car is null or char_length(p_car) > 20 then raise exception 'datos no válidos'; end if;
  insert into public.lap_times (player_id, name, track_id, car_id, lap_ms)
  values (p_player, trim(p_name), p_track, p_car, p_ms)
  on conflict (player_id, track_id, car_id) do update
    set ghost = case when excluded.lap_ms < public.lap_times.lap_ms then null else public.lap_times.ghost end,
        ghost_ms = case when excluded.lap_ms < public.lap_times.lap_ms then null else public.lap_times.ghost_ms end,
        lap_ms = least(public.lap_times.lap_ms, excluded.lap_ms), name = excluded.name, updated_at = now();
  update public.lap_times set name = trim(p_name) where player_id = p_player and name <> trim(p_name);
end $$;

-- Tiempo + recorrido: [x, y, z, rumbo, ...] a 40 Hz (una muestra cada 25 ms). El recorrido debe durar lo mismo que la vuelta (±0,6 s).
create or replace function public.submit_lap_ghost(p_player uuid, p_name text, p_track text, p_car text, p_ms integer, p_ghost jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(p_name) > 20 then raise exception 'nombre no válido'; end if;
  if p_ms is null or p_ms < 8000 or p_ms > 900000 then raise exception 'tiempo no válido'; end if;
  if p_track is null or char_length(p_track) > 60 or p_car is null or char_length(p_car) > 20 then raise exception 'datos no válidos'; end if;
  if p_ghost is null or jsonb_typeof(p_ghost) <> 'array' or jsonb_array_length(p_ghost) < 8 or jsonb_array_length(p_ghost) > 40000 or jsonb_array_length(p_ghost) % 4 <> 0 then
    raise exception 'fantasma no válido';
  end if;
  n := jsonb_array_length(p_ghost) / 4;
  if abs(n * 25 - p_ms) > 600 then raise exception 'el fantasma no coincide con el tiempo'; end if;
  insert into public.lap_times (player_id, name, track_id, car_id, lap_ms, ghost, ghost_ms)
  values (p_player, trim(p_name), p_track, p_car, p_ms, p_ghost, p_ms)
  on conflict (player_id, track_id, car_id) do update
    set ghost = case when excluded.lap_ms < public.lap_times.lap_ms then excluded.ghost else public.lap_times.ghost end,
        ghost_ms = case when excluded.lap_ms < public.lap_times.lap_ms then excluded.lap_ms else public.lap_times.ghost_ms end,
        lap_ms = least(public.lap_times.lap_ms, excluded.lap_ms),
        name = excluded.name, updated_at = now();
  update public.lap_times set name = trim(p_name) where player_id = p_player and name <> trim(p_name);
end $$;

-- Mejor vuelta REAL de una categoría en un circuito (aunque no tenga fantasma): devuelve el piloto, el coche y el fantasma solo si es de esa vuelta.
create or replace function public.best_lap(p_track text, p_cars text[], p_since timestamptz default null)
returns table (name text, car_id text, lap_ms integer, ghost jsonb)
language sql stable security definer set search_path = public as $$
  select l.name, l.car_id, l.lap_ms, case when l.ghost_ms = l.lap_ms then l.ghost end
  from public.lap_times l
  where l.track_id = p_track and l.car_id = any(p_cars) and (p_since is null or l.updated_at >= p_since)
  order by l.lap_ms asc limit 1
$$;

revoke all on function public.submit_lap(uuid, text, text, text, integer) from public;
revoke all on function public.submit_lap_ghost(uuid, text, text, text, integer, jsonb) from public;
revoke all on function public.best_lap(text, text[], timestamptz) from public;
grant execute on function public.submit_lap(uuid, text, text, text, integer) to anon, authenticated;
grant execute on function public.submit_lap_ghost(uuid, text, text, text, integer, jsonb) to anon, authenticated;
grant execute on function public.best_lap(text, text[], timestamptz) to anon, authenticated;
create index if not exists lap_times_best_idx on public.lap_times (track_id, lap_ms);
