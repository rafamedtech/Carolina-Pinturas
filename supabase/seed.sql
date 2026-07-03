-- The local app uses the hosted Supabase Auth project while Prisma points to the
-- local database. Mirror the hosted profiles so each JWT `sub` can be authorized
-- during local development.
insert into public.app_users (user_id, email, name, role, active)
values
  (
    '30c1b308-c994-4873-b0fa-60249ddc1123',
    'carolinapinturas@cvrtransportinc.com',
    'Administrador',
    'admin',
    true
  ),
  (
    '4064b4cb-1e9f-4dba-b371-c5da172c4cfc',
    'ventas@carolinapinturas.vercel.app',
    'Ventas',
    'vendedor',
    true
  ),
  (
    '20703bd7-541e-4833-ae32-578d90ce3e71',
    'mostrador@carolinapinturas.vercel.app',
    'Mostrador',
    'mostrador',
    true
  ),
  (
    '660f5214-2d47-4876-bfd5-cb0c02da6c3f',
    'reparto1@carolinapinturas.vercel.app',
    'Reparto 1',
    'repartidor',
    true
  ),
  (
    '05759768-c7ad-45a3-a75d-aeb736f1e335',
    'reparto2@carolinapinturas.vercel.app',
    'Reparto 2',
    'repartidor',
    true
  ),
  (
    'c94020a6-a2a0-4d2a-91fc-7e47d0e4a7ab',
    'igualaciones@carolinapinturas.vercel.app',
    'Igualaciones',
    'igualaciones',
    true
  )
on conflict (user_id) do update
set
  email = excluded.email,
  name = excluded.name,
  role = excluded.role,
  active = excluded.active;

insert into public.repartidores (nombre, user_id, activo)
values
  ('Ventas', '4064b4cb-1e9f-4dba-b371-c5da172c4cfc', true),
  ('Reparto 1', '660f5214-2d47-4876-bfd5-cb0c02da6c3f', true),
  ('Reparto 2', '05759768-c7ad-45a3-a75d-aeb736f1e335', true)
on conflict (user_id) do update
set
  nombre = excluded.nombre,
  activo = excluded.activo,
  updated_at = now();
