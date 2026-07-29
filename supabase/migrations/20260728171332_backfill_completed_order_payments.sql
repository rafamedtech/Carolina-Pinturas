insert into public.sales_order_payments (
  order_id,
  provider,
  external_status,
  payment_method,
  amount,
  currency_code,
  payment_date,
  reference,
  observations,
  created_by_name,
  created_by_email,
  created_by_role,
  created_at
)
select
  orders.id,
  'local',
  'not_applicable',
  coalesce(orders.payment_method, 'otro'),
  orders.total,
  orders.currency_code,
  coalesce(orders.payment_date, orders.order_date),
  'Migrado desde el estado histórico del pedido',
  'Pago generado al adoptar el registro unificado de pagos.',
  orders.created_by_name,
  orders.created_by_email,
  orders.created_by_role,
  orders.updated_at
from public.sales_orders as orders
where orders.payment_status = 'pago_recibido'
  and orders.total > 0
  and not exists (
    select 1
    from public.sales_order_payments as payments
    where payments.order_id = orders.id
  );
