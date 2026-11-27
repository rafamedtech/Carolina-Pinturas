<!-- Generado: 2026-11-27 | commit: aa2a705 | archivos: prisma/schema.prisma + 37 migraciones -->
# Datos — siigo-pinturas

PostgreSQL (Supabase). **Fuente de verdad del esquema: `supabase/migrations/*.sql`** (`supabase migration new`). `prisma/schema.prisma` refleja el modelo; validar con `pnpm db:validate` y `pnpm db:drift`. No usar `prisma migrate dev`. Cliente generado en `generated/prisma`.

## Identidad
AppUser (app_users) — rol (`admin|mostrador|vendedor|repartidor|igualaciones|consulta`), activo → repartidor?, expenses, productImages
Repartidor (repartidores) → appUser?, orders

## Catálogo Siigo (copia local)
SiigoProduct (siigo_products) — columnas consultables + `raw_payload` → prices, taxes, warehouses, components (Siigo), internalComponents/usedInComponents (ProductComponent, recetas internas), inventoryProduct, inventoryBalances
SiigoProductPrice (único productId+currencyCode+position) · SiigoProductTax · SiigoProductWarehouse · SiigoProductComponent · ProductComponent · ProductImage · ProductWrite (escrituras a Siigo pendientes/recuperables)
SiigoCustomer (siigo_customers) — terceros (clientes y proveedores), `is_internal_order_customer`, requisito de factura → phones, contacts, orders, expenses, purchases

## Ventas
OrderStatus (order_statuses) — catálogo en BD: borrador, ingresado, confirmado, surtido, en_espera, en_camino, entregado, facturado, cancelado (semilla en migraciones). El estado fiscal se deriva de SalesOrderSiigoInvoice (README)
SalesOrder (sales_orders) — 40 campos; snapshots de cliente; totales; estado; repartidor?; warehouse? → items, statusHistory, itemPriceHistory, payments, siigoInvoices, inventoryReservations, inventoryMovements
SalesOrderItem (único orderId+position) — snapshot de producto (código, nombre, unidad, precio, impuestos, payload)
SalesOrderItemPriceHistory · SalesOrderStatusHistory (fecha, usuario, rol, nota)
SalesOrderPayment (sales_order_payments) — método, importe, moneda, `request_id`, `siigo_voucher_id`
SalesOrderSiigoInvoice — vínculo a factura Siigo

## Compras
PurchaseOrder → provider (SiigoCustomer), items, receipts, invoices, events
PurchaseItem (único orderId+position) · PurchaseReceipt (→ warehouse?, inventoryMovements) · PurchaseReceiptItem · PurchaseInvoice → payments · PurchasePayment → expense? · PurchaseEvent (`request_id` idempotencia)
Expense (expenses) → provider, product?, purchasePayment?, createdByUser

## Inventario interno (independiente de Siigo)
InventorySettings (activación) · InventoryWarehouse · InventoryProduct (control interno) · InventoryBalance (warehouse+product) · InventoryReservation · InventoryMovement (origin_key, reversión, devoluciones) → InventoryMovementLine · InventoryCount → InventoryCountLine · InventoryEvent
Salida de stock al pasar pedido a `en_camino`/`entregado` (`inventory.syncOrderInventory`).

## Bitácora
AuditEvent (audit_events) — solo inserción (trigger inmutable), RLS sin acceso público: entidad, acción, actor (id, email, rol), motivo, fecha efectiva, origen, foto previa y cambios. Ver `docs/permisos.md`.

## Tablas leídas por CVR (contrato)
sales_orders, sales_order_items, sales_order_payments, siigo_customers, siigo_products, expenses, inventory_balances, inventory_warehouses — columnas en `integraciones.md`. Cualquier migración que las renombre/elimine requiere cambio coordinado en CVRTRANSPORT. Contrato exacto en `tests/contracts/cvr-carolina.json` (copia del canónico de CVRTRANSPORT); `tests/unit/cvr-carolina-contract.test.ts` lo valida contra `prisma/schema.prisma` y corre en CI.
