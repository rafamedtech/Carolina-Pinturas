-- El estado fiscal del pedido se mide con la factura de Siigo
-- (sin facturar / facturado), no con el estado operativo del pedido.
update public.sales_orders
set status_key = 'entregado'
where status_key = 'facturado';

update public.order_statuses
set is_active = false,
    updated_at = now()
where key = 'facturado';
