-- Descuentos por pedido y por partida, con tipo porcentaje o monto fijo.
-- discount_value guarda el valor capturado; discount_amount el importe calculado.
alter table public.sales_orders
  add column discount_type varchar(16) not null default 'porcentaje',
  add column discount_value numeric(20,6) not null default 0,
  add column discount_amount numeric(20,6) not null default 0;

alter table public.sales_order_items
  add column discount_type varchar(16) not null default 'porcentaje',
  add column discount_value numeric(20,6) not null default 0;
