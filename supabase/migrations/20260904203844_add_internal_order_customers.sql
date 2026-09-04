alter table public.siigo_customers
  add column is_internal_order_customer boolean not null default false;

create index siigo_customers_internal_order_customer_idx
  on public.siigo_customers(is_internal_order_customer, active);
