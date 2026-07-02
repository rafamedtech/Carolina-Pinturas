-- Repartidor becomes optional while an order is in borrador/ingresado.
-- It is only required once the order is confirmado (enforced in application logic).
alter table public.sales_orders
  alter column repartidor_id drop not null,
  alter column repartidor_nombre_snapshot drop not null;
