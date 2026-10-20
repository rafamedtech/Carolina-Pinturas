ALTER TABLE public.siigo_products
  ADD COLUMN available_for_purchase boolean NOT NULL DEFAULT true,
  ADD COLUMN available_for_sale boolean NOT NULL DEFAULT true,
  ADD COLUMN available_for_expense boolean NOT NULL DEFAULT true;
ALTER TABLE public.expenses ADD COLUMN product_id uuid REFERENCES public.siigo_products(id) ON DELETE RESTRICT;
CREATE INDEX expenses_product_id_idx ON public.expenses(product_id);
