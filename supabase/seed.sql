-- The local app uses the hosted Supabase Auth project while Prisma points to the
-- local database. Mirror the hosted administrator profile so its JWT `sub` can
-- be authorized during local development.
insert into public.app_users (user_id, email, name, role, active)
values (
  '30c1b308-c994-4873-b0fa-60249ddc1123',
  'carolinapinturas@cvrtransportinc.com',
  'Administrador',
  'admin',
  true
)
on conflict (user_id) do update
set
  email = excluded.email,
  name = excluded.name,
  role = excluded.role,
  active = excluded.active;
