create schema if not exists private;

revoke all on schema private from public;

create table public.app_users (
  user_id uuid primary key,
  email text not null unique,
  name text not null,
  role varchar(32) not null default 'vendedor',
  active boolean not null default true,
  created_at timestamptz(6) not null default now(),
  updated_at timestamptz(6) not null default now(),
  constraint app_users_role_valid check (role in ('admin', 'mostrador', 'vendedor')),
  constraint app_users_email_normalized check (email = lower(email))
);

create index app_users_role_active_idx on public.app_users (role, active);

alter table public.app_users enable row level security;
revoke all on table public.app_users from anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

create trigger app_users_set_updated_at
before update on public.app_users
for each row execute function private.set_updated_at();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_users (user_id, email, name, role)
  values (
    new.id,
    lower(coalesce(new.email, new.id::text)),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(coalesce(new.email, new.id::text), '@', 1)
    ),
    'vendedor'
  )
  on conflict (user_id) do update
  set email = excluded.email;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public;
grant execute on function private.handle_new_auth_user() to supabase_auth_admin;

create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute function private.handle_new_auth_user();

create or replace function private.handle_deleted_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.app_users where user_id = old.id;
  return old;
end;
$$;

revoke all on function private.handle_deleted_auth_user() from public;
grant execute on function private.handle_deleted_auth_user() to supabase_auth_admin;

create trigger on_auth_user_deleted
after delete on auth.users
for each row execute function private.handle_deleted_auth_user();

insert into public.app_users (user_id, email, name, role, active)
select
  id,
  lower(email),
  'Administrador',
  'admin',
  true
from auth.users
where lower(email) = 'carolinapinturas@cvrtransportinc.com'
on conflict (user_id) do update
set
  email = excluded.email,
  name = excluded.name,
  role = excluded.role,
  active = true;
