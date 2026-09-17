-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "purchase_payment_id" UUID;

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "folio" SERIAL NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'borrador',
    "version" INTEGER NOT NULL DEFAULT 1,
    "provider_id" UUID NOT NULL,
    "provider_name" TEXT NOT NULL,
    "provider_rfc" TEXT,
    "provider_payload" JSONB NOT NULL,
    "date" DATE NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL,
    "total" DECIMAL(20,2) NOT NULL,
    "notes" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "product_payload" JSONB NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL,
    "unit_cost" DECIMAL(20,6) NOT NULL,
    "total" DECIMAL(20,2) NOT NULL,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMPTZ(6),
    "void_reason" TEXT,

    CONSTRAINT "purchase_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_receipt_items" (
    "receipt_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL,

    CONSTRAINT "purchase_receipt_items_pkey" PRIMARY KEY ("receipt_id","item_id")
);

-- CreateTable
CREATE TABLE "purchase_invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "folio" VARCHAR(100) NOT NULL,
    "date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMPTZ(6),
    "void_reason" TEXT,

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoice_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "exchange_rate" DECIMAL(20,6) NOT NULL,
    "method" VARCHAR(32) NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMPTZ(6),
    "void_reason" TEXT,

    CONSTRAINT "purchase_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "request_hash" TEXT NOT NULL,
    "order_id" UUID NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "detail" JSONB NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_folio_key" ON "purchase_orders"("folio");

-- CreateIndex
CREATE INDEX "purchase_orders_provider_id_date_idx" ON "purchase_orders"("provider_id", "date");

-- CreateIndex
CREATE INDEX "purchase_orders_status_date_idx" ON "purchase_orders"("status", "date");

-- CreateIndex
CREATE INDEX "purchase_items_product_id_idx" ON "purchase_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_items_order_id_position_key" ON "purchase_items"("order_id", "position");

-- CreateIndex
CREATE INDEX "purchase_receipts_order_id_idx" ON "purchase_receipts"("order_id");

-- CreateIndex
CREATE INDEX "purchase_receipt_items_item_id_idx" ON "purchase_receipt_items"("item_id");

-- CreateIndex
CREATE INDEX "purchase_invoices_order_id_idx" ON "purchase_invoices"("order_id");

-- CreateIndex
CREATE INDEX "purchase_invoices_due_date_idx" ON "purchase_invoices"("due_date");

-- CreateIndex
CREATE INDEX "purchase_payments_invoice_id_idx" ON "purchase_payments"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_events_request_id_key" ON "purchase_events"("request_id");

-- CreateIndex
CREATE INDEX "purchase_events_order_id_created_at_idx" ON "purchase_events"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_purchase_payment_id_key" ON "expenses"("purchase_payment_id");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_purchase_payment_id_fkey" FOREIGN KEY ("purchase_payment_id") REFERENCES "purchase_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "siigo_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "siigo_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "purchase_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "purchase_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_events" ADD CONSTRAINT "purchase_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- All purchase access goes through authenticated admin server routes.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['purchase_orders','purchase_items','purchase_receipts','purchase_receipt_items','purchase_invoices','purchase_payments','purchase_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;
REVOKE ALL ON SEQUENCE public.purchase_orders_folio_seq FROM anon, authenticated;
ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_order_status CHECK (status IN ('borrador','confirmada','cancelada'));
ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_currency CHECK (currency_code IN ('MXN','USD'));
ALTER TABLE public.purchase_items ADD CONSTRAINT purchase_item_positive CHECK (quantity > 0 AND unit_cost > 0 AND total > 0);
ALTER TABLE public.purchase_receipt_items ADD CONSTRAINT purchase_receipt_positive CHECK (quantity > 0);
ALTER TABLE public.purchase_invoices ADD CONSTRAINT purchase_invoice_positive CHECK (amount > 0 AND due_date >= date);
ALTER TABLE public.purchase_payments ADD CONSTRAINT purchase_payment_positive CHECK (amount > 0 AND exchange_rate > 0);
