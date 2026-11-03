-- Fantasma del mejor tiempo del circuito (dorado) entre todos los jugadores.
-- Ejecutar una vez en el SQL Editor del proyecto de Supabase, después de leaderboard.sql.
-- Guarda el recorrido (ghost) de la vuelta de cada fila; solo se sustituye cuando la nueva vuelta es más rápida.

alter table public.lap_times add column if not exists ghost jsonb;

-- Recorrido de la vuelta: array plano [x, y, z, rumbo, x, y, z, rumbo, ...], máximo unos 40 000 valores.
create or replace function public.submit_lap_ghost(p_player uuid, p_name text, p_track text, p_car text, p_ms integer, p_ghost jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(p_name) > 20 then raise exception 'nombre no válido'; end if;
  if p_ms is null or p_ms < 8000 or p_ms > 900000 then raise exception 'tiempo no válido'; end if;
  if p_track is null or char_length(p_track) > 60 or p_car is null or char_length(p_car) > 20 then raise exception 'datos no válidos'; end if;
  if p_ghost is null or jsonb_typeof(p_ghost) <> 'array' or jsonb_array_length(p_ghost) < 8 or jsonb_array_length(p_ghost) > 40000 or jsonb_array_length(p_ghost) % 4 <> 0 then
    raise exception 'fantasma no válido';
  end if;
  insert into public.lap_times (player_id, name, track_id, car_id, lap_ms, ghost)
  values (p_player, trim(p_name), p_track, p_car, p_ms, p_ghost)
  on conflict (player_id, track_id, car_id) do update
    set ghost = case when excluded.lap_ms < public.lap_times.lap_ms then excluded.ghost else public.lap_times.ghost end,
        lap_ms = least(public.lap_times.lap_ms, excluded.lap_ms),
        name = excluded.name,
        updated_at = now();
  update public.lap_times set name = trim(p_name) where player_id = p_player and name <> trim(p_name);
end $$;

revoke all on function public.submit_lap_ghost(uuid, text, text, text, integer, jsonb) from public;
grant execute on function public.submit_lap_ghost(uuid, text, text, text, integer, jsonb) to anon, authenticated;

create index if not exists lap_times_ghost_idx on public.lap_times (track_id, lap_ms) where ghost is not null;
