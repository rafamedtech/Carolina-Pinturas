-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN     "inventory_managed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "warehouse_id" UUID;

-- AlterTable
ALTER TABLE "purchase_receipts" ADD COLUMN     "warehouse_id" UUID;

-- CreateTable
CREATE TABLE "inventory_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "inventory_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_warehouses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_products" (
    "product_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "inventory_products_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "inventory_balances" (
    "warehouse_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "minimum" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("warehouse_id","product_id")
);

-- CreateTable
CREATE TABLE "inventory_reservations" (
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL,

    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("order_id","product_id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "folio" SERIAL NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "origin_key" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "actor_id" UUID NOT NULL,
    "actor_name" TEXT NOT NULL,
    "actor_email" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL,
    "order_id" UUID,
    "receipt_id" UUID,
    "reversal_of_id" UUID,
    "source_movement_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movement_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "movement_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "delta" DECIMAL(20,6) NOT NULL,
    "balance_after" DECIMAL(20,6) NOT NULL,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "unit_code" TEXT,
    "unit_name" TEXT,
    "warehouse_name" TEXT NOT NULL,

    CONSTRAINT "inventory_movement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_counts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "warehouse_id" UUID NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'borrador',
    "version" INTEGER NOT NULL DEFAULT 1,
    "date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "movement_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_count_lines" (
    "count_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "base_version" INTEGER NOT NULL,
    "expected" DECIMAL(20,6) NOT NULL,
    "counted" DECIMAL(20,6),

    CONSTRAINT "inventory_count_lines_pkey" PRIMARY KEY ("count_id","product_id")
);

-- CreateTable
CREATE TABLE "inventory_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "request_hash" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" UUID NOT NULL,
    "actor_email" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_warehouses_code_key" ON "inventory_warehouses"("code");

-- CreateIndex
CREATE INDEX "inventory_balances_product_id_idx" ON "inventory_balances"("product_id");

-- CreateIndex
CREATE INDEX "inventory_reservations_warehouse_id_product_id_idx" ON "inventory_reservations"("warehouse_id", "product_id");

-- CreateIndex
CREATE INDEX "inventory_reservations_product_id_idx" ON "inventory_reservations"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_folio_key" ON "inventory_movements"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_origin_key_key" ON "inventory_movements"("origin_key");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_reversal_of_id_key" ON "inventory_movements"("reversal_of_id");

-- CreateIndex
CREATE INDEX "inventory_movements_order_id_idx" ON "inventory_movements"("order_id");

-- CreateIndex
CREATE INDEX "inventory_movements_receipt_id_idx" ON "inventory_movements"("receipt_id");

-- CreateIndex
CREATE INDEX "inventory_movements_source_movement_id_idx" ON "inventory_movements"("source_movement_id");

-- CreateIndex
CREATE INDEX "inventory_movements_date_folio_idx" ON "inventory_movements"("date", "folio");

-- CreateIndex
CREATE INDEX "inventory_movement_lines_warehouse_id_product_id_movement_i_idx" ON "inventory_movement_lines"("warehouse_id", "product_id", "movement_id");

-- CreateIndex
CREATE INDEX "inventory_movement_lines_product_id_idx" ON "inventory_movement_lines"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movement_lines_movement_id_warehouse_id_product_i_key" ON "inventory_movement_lines"("movement_id", "warehouse_id", "product_id");

-- CreateIndex
CREATE INDEX "inventory_counts_warehouse_id_status_idx" ON "inventory_counts"("warehouse_id", "status");

-- CreateIndex
CREATE INDEX "inventory_counts_movement_id_idx" ON "inventory_counts"("movement_id");

-- CreateIndex
CREATE INDEX "inventory_count_lines_product_id_idx" ON "inventory_count_lines"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_events_request_id_key" ON "inventory_events"("request_id");

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_products" ADD CONSTRAINT "inventory_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "siigo_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "siigo_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "siigo_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "purchase_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_source_movement_id_fkey" FOREIGN KEY ("source_movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement_lines" ADD CONSTRAINT "inventory_movement_lines_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement_lines" ADD CONSTRAINT "inventory_movement_lines_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement_lines" ADD CONSTRAINT "inventory_movement_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "siigo_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_count_id_fkey" FOREIGN KEY ("count_id") REFERENCES "inventory_counts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "siigo_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


INSERT INTO public.inventory_settings(id) VALUES (1);
ALTER TABLE public.inventory_settings ADD CONSTRAINT inventory_singleton CHECK(id = 1);
ALTER TABLE public.inventory_balances ADD CONSTRAINT inventory_valid_balance CHECK(quantity >= 0 AND reserved >= 0 AND reserved <= quantity AND minimum >= 0);
ALTER TABLE public.inventory_reservations ADD CONSTRAINT inventory_positive_reservation CHECK(quantity > 0);
ALTER TABLE public.inventory_movement_lines ADD CONSTRAINT inventory_valid_line CHECK(delta <> 0 AND balance_after >= 0);
ALTER TABLE public.inventory_counts ADD CONSTRAINT inventory_count_status CHECK(status IN ('borrador','pendiente','aplicado','cancelado'));
ALTER TABLE public.inventory_count_lines ADD CONSTRAINT inventory_valid_count CHECK(expected >= 0 AND (counted IS NULL OR counted >= 0));
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movement_type CHECK(type IN ('inicial','entrada','salida','traspaso','devolucion_cliente','devolucion_proveedor','ajuste','surtido','recepcion','reversion'));
CREATE INDEX IF NOT EXISTS sales_orders_warehouse_id_idx ON public.sales_orders(warehouse_id);
CREATE INDEX IF NOT EXISTS purchase_receipts_warehouse_id_idx ON public.purchase_receipts(warehouse_id);

INSERT INTO public.inventory_products(product_id, enabled)
SELECT id, COALESCE(type, 'Product') <> 'Service' FROM public.siigo_products;
CREATE SCHEMA IF NOT EXISTS private;
CREATE FUNCTION private.inventory_default_product() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  INSERT INTO public.inventory_products(product_id, enabled) VALUES(NEW.id, COALESCE(NEW.type, 'Product') <> 'Service');
  INSERT INTO public.inventory_balances(warehouse_id, product_id)
  SELECT id, NEW.id FROM public.inventory_warehouses WHERE active AND COALESCE(NEW.type, 'Product') <> 'Service';
  RETURN NEW;
END $$;
CREATE TRIGGER inventory_default_product AFTER INSERT ON public.siigo_products FOR EACH ROW EXECUTE FUNCTION private.inventory_default_product();
CREATE FUNCTION private.inventory_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'El historial de inventario es inmutable'; END $$;
CREATE TRIGGER inventory_movement_immutable BEFORE UPDATE OR DELETE ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION private.inventory_immutable();
CREATE TRIGGER inventory_line_immutable BEFORE UPDATE OR DELETE ON public.inventory_movement_lines FOR EACH ROW EXECUTE FUNCTION private.inventory_immutable();
CREATE TRIGGER inventory_event_immutable BEFORE UPDATE OR DELETE ON public.inventory_events FOR EACH ROW EXECUTE FUNCTION private.inventory_immutable();
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['inventory_settings','inventory_warehouses','inventory_products','inventory_balances','inventory_reservations','inventory_movements','inventory_movement_lines','inventory_counts','inventory_count_lines','inventory_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;
REVOKE ALL ON SEQUENCE public.inventory_movements_folio_seq FROM anon, authenticated;
REVOKE ALL ON FUNCTION private.inventory_default_product(), private.inventory_immutable() FROM PUBLIC;
