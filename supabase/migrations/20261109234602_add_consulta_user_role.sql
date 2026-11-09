alter table public.app_users drop constraint app_users_role_valid;
alter table public.app_users add constraint app_users_role_valid
  check (role in ('admin', 'mostrador', 'vendedor', 'repartidor', 'igualaciones', 'consulta'));

-- Provision the requested account, including databases where its profile was missing.
insert into public.app_users (user_id, email, name, role, active)
select id, lower(email), coalesce(nullif(trim(raw_user_meta_data ->> 'name'), ''), 'Consulta'), 'consulta', true
from auth.users where lower(email) = 'consulta@cvrtransportinc.com'
on conflict (user_id) do update set role = 'consulta', active = true;
