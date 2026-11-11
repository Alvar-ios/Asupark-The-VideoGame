-- Reto del día del 9-11-2026: pasa a ser Madring a mitad de jornada.
-- Borra intentos y resultados de ese día, hechos en otro circuito. Ejecutar una sola vez, cuanto antes.
delete from public.daily_results where day = '2026-11-09';
delete from public.daily_state where day = '2026-11-09';
