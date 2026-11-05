-- Cuentas, perfiles, amigos, estadísticas y logros. Requiere Authentication → Email con "Confirm email" desactivado (se usa usuario@driftrush.game + contraseña).
-- Las tablas son privadas: todo pasa por funciones security definer que identifican al usuario con auth.uid().

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  flag text not null default 'es' check (flag ~ '^[a-z]{2}$'),
  helmet text not null default 'e63946|ffffff|111827|1' check (char_length(helmet) <= 40),
  created_at timestamptz not null default now()
);
create table if not exists public.friendships (
  requester uuid not null references public.profiles(user_id) on delete cascade,
  addressee uuid not null references public.profiles(user_id) on delete cascade,
  accepted boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (requester, addressee), check (requester <> addressee)
);
create table if not exists public.race_results (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  track_id text not null, car_id text not null, pos integer not null check (pos between 1 and 20), field integer not null check (field between 2 and 20),
  created_at timestamptz not null default now()
);
create table if not exists public.car_groups (car_id text primary key, grp text not null);
insert into public.car_groups (car_id, grp) values
('minitoon','cartoon'),
('gtr','cartoon'),
('f360','cartoon'),
('rx7toon','cartoon'),
('mclaren','cartoon'),
('kart_ini','karts'),
('kart_rent','karts'),
('kart_comp','karts'),
('kart_super','karts'),
('qashqai','cv100'),
('bora','cv100'),
('cupra','cv100'),
('golf','cv150'),
('mini','cv150'),
('minis','cv150'),
('mx5','cv150'),
('z240','cv150'),
('mustang','cv150'),
('e30','cv150'),
('s4','cv200'),
('m3','cv200'),
('porsche','cv200'),
('cobra','cv200'),
('etype','cv200'),
('z8','cv200'),
('f550','cv200'),
('stradale','competicion'),
('slr','competicion'),
('fordgt','competicion'),
('fordgt06','competicion'),
('xj13','competicion'),
('lotus','f1'),
('aston','f1'),
('f312t','f1'),
('r24','f1'),
('brawngp','f1'),
('mp45','f1'),
('mp423','f1')
on conflict (car_id) do update set grp = excluded.grp;
alter table public.profiles enable row level security; alter table public.friendships enable row level security;
alter table public.race_results enable row level security; alter table public.car_groups enable row level security;
drop policy if exists "perfiles publicos" on public.profiles;
create policy "perfiles publicos" on public.profiles for select to anon, authenticated using (true);
drop policy if exists "grupos publicos" on public.car_groups;
create policy "grupos publicos" on public.car_groups for select to anon, authenticated using (true);
create index if not exists race_results_user_idx on public.race_results (user_id);
create index if not exists lap_times_player_idx on public.lap_times (player_id);

create or replace function public.username_available(p text) returns boolean language sql stable security definer set search_path = public as $$
  select p ~ '^[a-z0-9_]{3,20}$' and not exists (select 1 from public.profiles where username = p) $$;

create or replace function public.create_profile(p_username text, p_flag text default 'es', p_helmet text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sin sesión'; end if;
  if p_username !~ '^[a-z0-9_]{3,20}$' then raise exception 'usuario no válido (3-20: letras minúsculas, números o _)'; end if;
  insert into public.profiles (user_id, username, flag, helmet) values (auth.uid(), p_username, coalesce(nullif(p_flag,''),'es'), coalesce(p_helmet,'e63946|ffffff|111827|1'));
end $$;

create or replace function public.update_profile(p_flag text, p_helmet text) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sin sesión'; end if;
  update public.profiles set flag = case when p_flag ~ '^[a-z]{2}$' then p_flag else flag end, helmet = case when p_helmet ~ '^([0-9a-fA-F]{6}[|]){3}[0-9]$' then p_helmet else helmet end where user_id = auth.uid();
end $$;

create or replace function public.friend_request(p_username text) returns text language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if auth.uid() is null then raise exception 'sin sesión'; end if;
  select user_id into t from public.profiles where username = lower(trim(p_username));
  if t is null then raise exception 'no existe ese usuario'; end if;
  if t = auth.uid() then raise exception 'eres tú'; end if;
  if exists (select 1 from public.friendships where requester = t and addressee = auth.uid()) then
    update public.friendships set accepted = true where requester = t and addressee = auth.uid(); return 'amigos';
  end if;
  insert into public.friendships (requester, addressee) values (auth.uid(), t) on conflict do nothing; return 'solicitud enviada';
end $$;

create or replace function public.friend_respond(p_user uuid, p_accept boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sin sesión'; end if;
  if p_accept then update public.friendships set accepted = true where requester = p_user and addressee = auth.uid();
  else delete from public.friendships where (requester = p_user and addressee = auth.uid()) or (requester = auth.uid() and addressee = p_user); end if;
end $$;

create or replace function public.my_friends() returns table (user_id uuid, username text, flag text, helmet text, status text)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.username, p.flag, p.helmet,
    case when f.accepted then 'amigo' when f.requester = auth.uid() then 'enviada' else 'recibida' end
  from public.friendships f join public.profiles p on p.user_id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where auth.uid() in (f.requester, f.addressee) order by f.accepted desc, p.username $$;

create or replace function public.submit_result(p_track text, p_car text, p_pos integer, p_field integer) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if p_track is null or char_length(p_track) > 60 or p_car is null or char_length(p_car) > 20 then raise exception 'datos no válidos'; end if;
  insert into public.race_results (user_id, track_id, car_id, pos, field) values (auth.uid(), p_track, p_car, p_pos, p_field);
end $$;

-- Récords por circuito y categoría (excluye la pista del día): quién tiene el mejor tiempo de cada una
create or replace view public.track_kings with (security_invoker = false) as
  select distinct on (l.track_id, g.grp) l.track_id, g.grp, l.player_id, l.name, l.car_id, l.lap_ms
  from public.lap_times l join public.car_groups g on g.car_id = l.car_id
  where l.track_id not like 'daily:%' order by l.track_id, g.grp, l.lap_ms asc;
revoke all on public.track_kings from anon, authenticated;

create or replace function public.user_stats(p_user uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pr record; res jsonb;
begin
  select * into pr from public.profiles where user_id = p_user; if not found then return null; end if;
  select jsonb_build_object(
    'user_id', pr.user_id, 'username', pr.username, 'flag', pr.flag, 'helmet', pr.helmet, 'since', pr.created_at,
    'laps', (select count(*) from public.lap_times where player_id = p_user),
    'tracks', (select count(distinct track_id) from public.lap_times where player_id = p_user and track_id not like 'daily:%'),
    'races', (select count(*) from public.race_results where user_id = p_user),
    'wins', (select count(*) from public.race_results where user_id = p_user and pos = 1),
    'podiums', (select count(*) from public.race_results where user_id = p_user and pos <= 3),
    'kings', coalesce((select jsonb_agg(jsonb_build_object('track', k.track_id, 'grp', k.grp, 'ms', k.lap_ms, 'car', k.car_id)) from public.track_kings k where k.player_id = p_user), '[]'::jsonb),
    'wins_rank', (select r from (select user_id, rank() over (order by count(*) desc) r from public.race_results where pos = 1 group by user_id) w where user_id = p_user)
  ) into res;
  return res;
end $$;

-- Mejor tiempo por circuito y categoría de dos usuarios, para la rivalidad
create or replace function public.rivalry(p_friend uuid) returns table (track_id text, grp text, my_ms integer, their_ms integer)
language sql stable security definer set search_path = public as $$
  with b as (select l.player_id, l.track_id, g.grp, min(l.lap_ms) ms from public.lap_times l join public.car_groups g on g.car_id = l.car_id
             where l.player_id in (auth.uid(), p_friend) and l.track_id not like 'daily:%' group by 1,2,3)
  select coalesce(a.track_id, c.track_id), coalesce(a.grp, c.grp), a.ms, c.ms
  from (select * from b where player_id = auth.uid()) a full join (select * from b where player_id = p_friend) c on a.track_id = c.track_id and a.grp = c.grp
  where exists (select 1 from public.friendships f where f.accepted and ((f.requester = auth.uid() and f.addressee = p_friend) or (f.requester = p_friend and f.addressee = auth.uid())))
  order by 1, 2 $$;

-- Salón de la fama global: más récords y más victorias
create or replace function public.hall() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'records', coalesce((select jsonb_agg(x) from (select k.name, count(*) n from public.track_kings k group by k.player_id, k.name order by n desc, k.name limit 10) x), '[]'::jsonb),
    'wins', coalesce((select jsonb_agg(x) from (select p.username as name, count(*) n from public.race_results r join public.profiles p on p.user_id = r.user_id where r.pos = 1 group by p.user_id, p.username order by n desc, p.username limit 10) x), '[]'::jsonb)
  ) $$;

revoke all on function public.username_available(text), public.create_profile(text,text,text), public.update_profile(text,text), public.friend_request(text), public.friend_respond(uuid,boolean), public.my_friends(), public.submit_result(text,text,integer,integer), public.user_stats(uuid), public.rivalry(uuid), public.hall() from public;
grant execute on function public.username_available(text), public.user_stats(uuid), public.hall() to anon, authenticated;
grant execute on function public.create_profile(text,text,text), public.update_profile(text,text), public.friend_request(text), public.friend_respond(uuid,boolean), public.my_friends(), public.submit_result(text,text,integer,integer), public.rivalry(uuid) to authenticated;
