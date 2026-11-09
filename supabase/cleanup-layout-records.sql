-- Borra los tiempos antiguos de Mario Circuit (todas las categorías) y de Spa en categoría F1,
-- hechos con el trazado anterior. Solo afecta a filas guardadas antes del 4 de noviembre de 2026.
-- Ejecutar una vez en el SQL Editor del proyecto de Supabase.

delete from public.lap_times
where updated_at < '2026-11-04T00:00:00Z'
  and (
    track_id = 'prisma'
    or (track_id = 'spa' and car_id in ('lotus', 'aston', 'f312t', 'r24', 'brawngp', 'mp45', 'mp423'))
  );

-- Selva Amazónica (Perú) y Madring: trazados rediseñados (9 de noviembre de 2026). Borra TODOS sus tiempos y fantasmas anteriores.
delete from public.lap_times
where updated_at < '2026-11-09T17:32:00Z' and track_id in ('amazonas', 'madring');

-- Madring: alturas y chicane rehechas (v0.0.73). Borra TODOS sus tiempos y fantasmas anteriores a v0.0.74.
delete from public.lap_times
where updated_at < '2026-11-09T20:40:00Z' and track_id = 'madring';
