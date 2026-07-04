alter table public.sales_orders
  add column payment_status varchar(32) not null default 'pendiente_pago',
  add column payment_method varchar(32);
