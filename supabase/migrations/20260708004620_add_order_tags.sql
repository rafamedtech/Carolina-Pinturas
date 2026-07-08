alter table public.sales_orders
  add column tags text[] not null default '{}';
