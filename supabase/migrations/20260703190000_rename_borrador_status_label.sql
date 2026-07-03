-- The "borrador" status is shown to users as a quote ("Cotización"). Only the
-- display label changes; the status key stays "borrador".
update public.order_statuses
set label = 'Cotización',
    updated_at = now()
where key = 'borrador';
