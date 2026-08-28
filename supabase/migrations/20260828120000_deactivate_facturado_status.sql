-- El estado fiscal del pedido se mide con la factura de Siigo
-- (sin facturar / facturado), no con el estado operativo del pedido.
with reasignados as (
  update public.sales_orders
  set status_key = 'entregado',
      version = version + 1,
      updated_at = now()
  where status_key = 'facturado'
  returning id
)
insert into public.sales_order_status_history
  (order_id, from_status_key, to_status_key, note, changed_by_name, changed_by_email, changed_by_role, changed_at)
select
  id,
  'facturado',
  'entregado',
  'Migración automática: el estado “Facturado” se retiró; la factura ahora se rastrea desde Siigo.',
  'Sistema',
  'sistema@carolinapinturas.local',
  'admin',
  now()
from reasignados;

update public.order_statuses
set is_active = false,
    updated_at = now()
where key = 'facturado';
