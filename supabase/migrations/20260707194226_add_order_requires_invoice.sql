alter table public.sales_orders
  add column requires_invoice boolean not null default false;
