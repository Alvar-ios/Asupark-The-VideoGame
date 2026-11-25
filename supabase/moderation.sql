-- Moderación de nombres de piloto. Ejecutar en el SQL Editor de Supabase (se puede lanzar varias veces).
-- La lista debe coincidir con src/names.js.

create or replace function public.is_bad_name(p text) returns boolean language sql immutable as $$
  select coalesce(
    regexp_replace(translate(lower(coalesce(p, '')), '0134578@$!áéíóúüàèìòùïñ', 'oieastbasiaeiouuaeiouin'), '[^a-z]', '', 'g')
    ~ '(nigg|negrata|negromierda|sudaca|maricon|faggot|hitler|heilh|neonazi|retrasado|subnormal|mongolo|hijodeputa|hijoputa|follar|violador|pedofilo)',
    false);
$$;

-- 1) VER qué hay ahora mismo (ejecuta esto primero y revisa el resultado)
select 'lap_times' as tabla, name as nombre, count(*) from public.lap_times where public.is_bad_name(name) group by name
union all select 'daily_results', name, count(*) from public.daily_results where public.is_bad_name(name) group by name
union all select 'profiles', username, count(*) from public.profiles where public.is_bad_name(username) group by username;

-- 2) LIMPIAR: los tiempos se conservan, solo cambia el nombre visible
update public.lap_times set name = 'Piloto' where public.is_bad_name(name);
update public.daily_results set name = 'Piloto' where public.is_bad_name(name);
update public.profiles set username = 'piloto_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8) where public.is_bad_name(username);
-- Ojo: quien tuviera una cuenta con uno de esos nombres dejará de poder entrar con él.

-- 3) IMPEDIR que vuelva a pasar
create or replace function public.clean_pilot_name() returns trigger language plpgsql as $$
begin
  if public.is_bad_name(new.name) then new.name := 'Piloto'; end if;
  return new;
end $$;

create or replace function public.reject_bad_username() returns trigger language plpgsql as $$
begin
  if public.is_bad_name(new.username) then raise exception 'Ese nombre no está permitido'; end if;
  return new;
end $$;

drop trigger if exists lap_times_clean_name on public.lap_times;
create trigger lap_times_clean_name before insert or update of name on public.lap_times for each row execute function public.clean_pilot_name();
drop trigger if exists daily_results_clean_name on public.daily_results;
create trigger daily_results_clean_name before insert or update of name on public.daily_results for each row execute function public.clean_pilot_name();
drop trigger if exists profiles_reject_name on public.profiles;
create trigger profiles_reject_name before insert or update of username on public.profiles for each row execute function public.reject_bad_username();
