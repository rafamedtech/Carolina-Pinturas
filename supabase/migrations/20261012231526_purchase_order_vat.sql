-- No inferimos impuestos de órdenes históricas: conservan su importe original.
ALTER TABLE public.purchase_orders
  ADD COLUMN subtotal numeric(20, 2),
  ADD COLUMN vat_rate integer NOT NULL DEFAULT 0,
  ADD COLUMN vat_amount numeric(20, 2) NOT NULL DEFAULT 0;

UPDATE public.purchase_orders SET subtotal = total;

ALTER TABLE public.purchase_orders
  ALTER COLUMN subtotal SET NOT NULL,
  ADD CONSTRAINT purchase_orders_vat_rate_check CHECK (vat_rate IN (0, 8, 16)),
  ADD CONSTRAINT purchase_orders_vat_amount_check CHECK (vat_amount = round(subtotal * vat_rate / 100, 2)),
  ADD CONSTRAINT purchase_orders_total_check CHECK (total = subtotal + vat_amount);
