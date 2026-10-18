-- AlterTable
ALTER TABLE "siigo_products" ADD COLUMN     "composition_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "internal_kind" VARCHAR(16) NOT NULL DEFAULT 'product';

-- AlterTable
ALTER TABLE "sales_order_items" ADD COLUMN     "inventory_recipe" JSONB;

-- CreateTable
CREATE TABLE "product_components" (
    "product_id" UUID NOT NULL,
    "component_id" UUID NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL,

    CONSTRAINT "product_components_pkey" PRIMARY KEY ("product_id","component_id")
);

-- CreateTable
CREATE TABLE "product_writes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID,
    "is_new" BOOLEAN NOT NULL DEFAULT false,
    "code" VARCHAR(30) NOT NULL,
    "input" JSONB NOT NULL,
    "state" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_writes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_components_component_id_idx" ON "product_components"("component_id");

-- CreateIndex
CREATE INDEX "product_writes_product_id_idx" ON "product_writes"("product_id");

-- AddForeignKey
ALTER TABLE "product_components" ADD CONSTRAINT "product_components_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "siigo_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_components" ADD CONSTRAINT "product_components_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "siigo_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public.siigo_products ADD CONSTRAINT product_internal_kind CHECK (internal_kind IN ('product', 'composite'));
ALTER TABLE public.siigo_products ADD CONSTRAINT product_composition_version CHECK (composition_version > 0);
ALTER TABLE public.product_components ADD CONSTRAINT product_component_positive CHECK (quantity > 0);
ALTER TABLE public.product_components ADD CONSTRAINT product_component_no_self CHECK (product_id <> component_id);
ALTER TABLE public.product_writes ADD CONSTRAINT product_write_state CHECK (state IN ('pending', 'unknown', 'synced', 'failed'));
CREATE UNIQUE INDEX product_writes_open_code ON public.product_writes(code) WHERE state IN ('pending', 'unknown');
CREATE UNIQUE INDEX product_writes_open_product ON public.product_writes(product_id) WHERE state IN ('pending', 'unknown');
CREATE INDEX sales_order_items_inventory_recipe_idx ON public.sales_order_items USING gin(inventory_recipe);

ALTER TABLE public.product_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_writes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_components, public.product_writes FROM anon, authenticated;

-- New Siigo products receive only local tracking. Composites never own stock.
CREATE OR REPLACE FUNCTION private.inventory_default_product() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  INSERT INTO public.inventory_products(product_id, enabled)
  VALUES(NEW.id, NEW.internal_kind = 'product' AND COALESCE(NEW.type, 'Product') = 'Product');
  INSERT INTO public.inventory_balances(warehouse_id, product_id)
  SELECT id, NEW.id FROM public.inventory_warehouses
  WHERE active AND NEW.internal_kind = 'product' AND COALESCE(NEW.type, 'Product') = 'Product';
  RETURN NEW;
END $$;

CREATE FUNCTION private.validate_product_component() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(187645);
  IF NOT EXISTS (SELECT 1 FROM public.siigo_products WHERE id = NEW.product_id AND internal_kind = 'composite')
    OR NOT EXISTS (
      SELECT 1 FROM public.siigo_products p JOIN public.inventory_products i ON i.product_id = p.id
      WHERE p.id = NEW.component_id AND p.internal_kind = 'product'
        AND COALESCE(p.type, 'Product') = 'Product' AND p.active IS DISTINCT FROM false AND i.enabled
    ) THEN RAISE EXCEPTION 'Los componentes deben ser productos simples, activos y con control interno';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_product_component BEFORE INSERT OR UPDATE ON public.product_components
FOR EACH ROW EXECUTE FUNCTION private.validate_product_component();
REVOKE ALL ON FUNCTION private.validate_product_component() FROM PUBLIC;
