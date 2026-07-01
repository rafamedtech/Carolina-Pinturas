alter table public.sales_orders
  add column vendedor_nombre text,
  add column vendedor_email text,
  add column repartidor_nombre text,
  add column repartidor_email text,
  add column remision text;

update public.sales_orders
set
  vendedor_nombre = created_by_name,
  vendedor_email = created_by_email,
  repartidor_nombre = created_by_name,
  repartidor_email = created_by_email;

alter table public.sales_orders
  alter column vendedor_nombre set not null,
  alter column vendedor_email set not null,
  alter column repartidor_nombre set not null,
  alter column repartidor_email set not null;

create index sales_orders_vendedor_email_idx
  on public.sales_orders (vendedor_email);

create index sales_orders_repartidor_email_idx
  on public.sales_orders (repartidor_email);
