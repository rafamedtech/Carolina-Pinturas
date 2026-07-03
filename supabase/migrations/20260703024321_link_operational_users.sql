alter table public.app_users
  drop constraint app_users_role_valid;

alter table public.app_users
  add constraint app_users_role_valid
  check (role in ('admin', 'mostrador', 'vendedor', 'repartidor', 'igualaciones'));

alter table public.repartidores
  add column user_id uuid
  references public.app_users (user_id)
  on delete set null;

create unique index repartidores_user_id_key
  on public.repartidores (user_id);

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(coalesce(new.email, new.id::text));
  repartidor_name text := case normalized_email
    when 'ventas@carolinapinturas.vercel.app' then 'Ventas'
    when 'reparto1@carolinapinturas.vercel.app' then 'Reparto 1'
    when 'reparto2@carolinapinturas.vercel.app' then 'Reparto 2'
    else null
  end;
  operational_email boolean := normalized_email in (
    'ventas@carolinapinturas.vercel.app',
    'mostrador@carolinapinturas.vercel.app',
    'reparto1@carolinapinturas.vercel.app',
    'reparto2@carolinapinturas.vercel.app',
    'igualaciones@carolinapinturas.vercel.app'
  );
begin
  insert into public.app_users (user_id, email, name, role)
  values (
    new.id,
    normalized_email,
    case normalized_email
      when 'ventas@carolinapinturas.vercel.app' then 'Ventas'
      when 'mostrador@carolinapinturas.vercel.app' then 'Mostrador'
      when 'reparto1@carolinapinturas.vercel.app' then 'Reparto 1'
      when 'reparto2@carolinapinturas.vercel.app' then 'Reparto 2'
      when 'igualaciones@carolinapinturas.vercel.app' then 'Igualaciones'
      else coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
        split_part(normalized_email, '@', 1)
      )
    end,
    case normalized_email
      when 'mostrador@carolinapinturas.vercel.app' then 'mostrador'
      when 'reparto1@carolinapinturas.vercel.app' then 'repartidor'
      when 'reparto2@carolinapinturas.vercel.app' then 'repartidor'
      when 'igualaciones@carolinapinturas.vercel.app' then 'igualaciones'
      else 'vendedor'
    end
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    name = case
      when operational_email then excluded.name
      else app_users.name
    end,
    role = case
      when operational_email then excluded.role
      else app_users.role
    end;

  if repartidor_name is not null then
    update public.repartidores
    set
      user_id = new.id,
      activo = true,
      updated_at = now()
    where id = (
      select repartidor.id
      from public.repartidores repartidor
      where lower(repartidor.nombre) = lower(repartidor_name)
        and repartidor.user_id is null
      order by repartidor.created_at
      limit 1
    );

    if not exists (
      select 1
      from public.repartidores repartidor
      where repartidor.user_id = new.id
    ) then
      insert into public.repartidores (nombre, user_id)
      values (repartidor_name, new.id);
    end if;
  end if;

  return new;
end;
$$;

with operational_users (email, name, role) as (
  values
    ('ventas@carolinapinturas.vercel.app', 'Ventas', 'vendedor'),
    ('mostrador@carolinapinturas.vercel.app', 'Mostrador', 'mostrador'),
    ('reparto1@carolinapinturas.vercel.app', 'Reparto 1', 'repartidor'),
    ('reparto2@carolinapinturas.vercel.app', 'Reparto 2', 'repartidor'),
    ('igualaciones@carolinapinturas.vercel.app', 'Igualaciones', 'igualaciones')
)
insert into public.app_users (user_id, email, name, role, active)
select
  auth_user.id,
  lower(auth_user.email),
  operational_user.name,
  operational_user.role,
  true
from operational_users operational_user
join auth.users auth_user
  on lower(auth_user.email) = operational_user.email
on conflict (user_id) do update
set
  email = excluded.email,
  name = excluded.name,
  role = excluded.role,
  active = true;

with delivery_users (email, repartidor_name) as (
  values
    ('ventas@carolinapinturas.vercel.app', 'Ventas'),
    ('reparto1@carolinapinturas.vercel.app', 'Reparto 1'),
    ('reparto2@carolinapinturas.vercel.app', 'Reparto 2')
),
delivery_profiles as (
  select app_user.user_id, delivery_user.repartidor_name
  from delivery_users delivery_user
  join public.app_users app_user on app_user.email = delivery_user.email
),
existing_repartidores as (
  select
    delivery_profile.user_id,
    (
      select repartidor.id
      from public.repartidores repartidor
      where lower(repartidor.nombre) = lower(delivery_profile.repartidor_name)
        and repartidor.user_id is null
      order by repartidor.created_at
      limit 1
    ) as repartidor_id
  from delivery_profiles delivery_profile
)
update public.repartidores repartidor
set
  user_id = existing_repartidor.user_id,
  activo = true,
  updated_at = now()
from existing_repartidores existing_repartidor
where repartidor.id = existing_repartidor.repartidor_id;

with delivery_users (email, repartidor_name) as (
  values
    ('ventas@carolinapinturas.vercel.app', 'Ventas'),
    ('reparto1@carolinapinturas.vercel.app', 'Reparto 1'),
    ('reparto2@carolinapinturas.vercel.app', 'Reparto 2')
)
insert into public.repartidores (nombre, user_id)
select delivery_user.repartidor_name, app_user.user_id
from delivery_users delivery_user
join public.app_users app_user on app_user.email = delivery_user.email
where not exists (
  select 1
  from public.repartidores repartidor
  where repartidor.user_id = app_user.user_id
);
