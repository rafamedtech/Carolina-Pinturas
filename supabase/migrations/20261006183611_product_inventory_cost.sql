ALTER TABLE public.siigo_products
  ADD COLUMN initial_unit_cost numeric(20,6),
  ADD COLUMN initial_cost_currency varchar(3),
  ADD COLUMN unit_cost numeric(20,6),
  ADD COLUMN cost_currency varchar(3),
  ADD CONSTRAINT siigo_products_initial_cost_check CHECK (
    (initial_unit_cost IS NULL AND initial_cost_currency IS NULL) OR
    (initial_unit_cost IS NOT NULL AND initial_unit_cost > 0 AND initial_cost_currency IS NOT NULL AND initial_cost_currency IN ('MXN', 'USD'))
  ),
  ADD CONSTRAINT siigo_products_cost_check CHECK (
    (unit_cost IS NULL AND cost_currency IS NULL) OR
    (unit_cost IS NOT NULL AND unit_cost > 0 AND cost_currency IS NOT NULL AND cost_currency IN ('MXN', 'USD'))
  );
ALTER TABLE public.inventory_count_lines
  ADD COLUMN unit_cost numeric(20,6),
  ADD COLUMN cost_currency varchar(3),
  ADD CONSTRAINT inventory_count_lines_cost_check CHECK (
    (unit_cost IS NULL AND cost_currency IS NULL) OR
    (unit_cost IS NOT NULL AND unit_cost > 0 AND cost_currency IS NOT NULL AND cost_currency IN ('MXN', 'USD'))
  );

-- Backfill only actual, active receipts; drafts and confirmations have no cost effect.
UPDATE public.siigo_products p SET unit_cost = latest.unit_cost, cost_currency = latest.currency_code
FROM (
  SELECT DISTINCT ON (i.product_id) i.product_id, i.unit_cost, o.currency_code
  FROM public.purchase_receipt_items ri
  JOIN public.purchase_receipts r ON r.id = ri.receipt_id
  JOIN public.purchase_items i ON i.id = ri.item_id
  JOIN public.purchase_orders o ON o.id = r.order_id
  WHERE r.voided_at IS NULL AND o.status = 'confirmada' AND ri.quantity > 0
  ORDER BY i.product_id, r.date DESC, r.created_at DESC, r.id DESC, i.position DESC
) latest WHERE p.id = latest.product_id;
