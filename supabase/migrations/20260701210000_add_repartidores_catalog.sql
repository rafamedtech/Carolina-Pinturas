create table public.repartidores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index repartidores_nombre_idx on public.repartidores (nombre);

alter table public.sales_orders
  add column repartidor_id uuid references public.repartidores (id),
  add column repartidor_telefono_snapshot text;

insert into public.repartidores (nombre)
select distinct repartidor_nombre
from public.sales_orders
where repartidor_nombre is not null;

update public.sales_orders so
set repartidor_id = r.id
from public.repartidores r
where r.nombre = so.repartidor_nombre
  and so.repartidor_id is null;

alter table public.sales_orders
  rename column repartidor_nombre to repartidor_nombre_snapshot;

alter table public.sales_orders
  drop column repartidor_email;

alter table public.sales_orders
  alter column repartidor_id set not null;

create index sales_orders_repartidor_id_idx on public.sales_orders (repartidor_id);
