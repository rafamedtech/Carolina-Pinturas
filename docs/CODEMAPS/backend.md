<!-- Generado: 2026-11-27 | commit: aa2a705 | archivos: 89 rutas + 44 utils + 15 shared -->
# Backend — siigo-pinturas

Nitro (`server/`). Sesión: `server/middleware/supabase-session.ts` renueva cookies; `server/utils/supabase.ts#getVerifiedSupabaseClaims` verifica JWT; `server/utils/auth.ts#getAppSession` mapea `claims.sub` → `app_users`. Callback de Auth: `server/routes/callback.get.ts`.

## Autorización
- `requireUser(event)` — usuario activo con rol válido.
- `requireRole(event, roles)` — admin siempre pasa. `consulta` pasa en GET/HEAD bajo `/api/(orders|purchases|reports|inventory|siigo|payments|products|dashboard|repartidores|expenses)`.
- Roles: admin, mostrador, vendedor, repartidor, igualaciones, consulta (`app/types/siigo.ts#UserRole`).
- Conjuntos (`app/utils/roleAccess.ts`, fuente única de permisos de UI y estados por rol):
  ENT = ORDER_ENTRY_ROLES (admin, mostrador, vendedor, repartidor)
  LOG = ORDER_LOGISTICS_ROLES (admin, mostrador, vendedor)
  PROD = PRODUCT_MANAGEMENT_ROLES (admin)
  INVR / INVW = INVENTORY_READ_ROLES (admin, mostrador, vendedor) / INVENTORY_WRITE_ROLES (admin, mostrador) — `server/utils/inventory.ts`
- Rutas con `requireUser` aplican el permiso fino dentro de `orders.ts` (estados editables por rol, `canEditOrderRemision`, etc.).

## Rutas `server/api` → guarda → util principal
### Sesión, usuarios, configuración
GET  /api/auth/session → sesión → auth.getAppSession
GET  /api/users · PATCH /api/users/[id] → admin → app_users
GET  /api/siigo/status → admin → siigo.siigoConfigured
GET  /api/catalog/prices → pública (lista de precios) → stored-products
PUT  /api/internal-order-customers → admin → siigo-customer-repository.replaceInternalOrderCustomers

### Pedidos (ventas y cotizaciones) — `orders.ts` (1711 l)
GET  /api/orders → user → listOrders
POST /api/orders → ENT → createOrder (revalida cliente en Siigo y productos en PostgreSQL; snapshots)
GET  /api/orders/[id] → user → getOrder · PUT → ENT → updateOrder
PATCH /api/orders/[id]/status → user → updateOrderStatus (+ syncOrderInventory)
PATCH /api/orders/[id]/remision · /pago → user
PATCH /api/orders/[id]/repartidor · /tags · /invoice-requirement → LOG
PATCH /api/orders/[id]/warehouse → admin,mostrador,vendedor → inventory_warehouses
PATCH /api/orders/[id]/items/[itemId]/{cantidad,precio,observaciones} · DELETE /items/[itemId] → user
GET  /api/orders/[id]/inventory → user → orderInventoryView
GET  /api/orders/[id]/return-context → INVW → orderReturnContext
POST /api/orders/[id]/ticket-print → user → ticket-printer (impresora de red)
GET  /api/orders/statuses → user · /tags → ENT · /counter-customer → ENT · /inventory-context → ENT
GET  /api/orders/customers/[id]/balance → ENT → customer-balance

### Cobros y documentos Siigo
GET  /api/payments → LOG
GET  /api/orders/[id]/payments/context · POST /api/orders/[id]/payments → LOG → order-payments
DELETE /api/orders/[id]/payments/[paymentId] → user → order-payments.deleteOrderPayment (rol validado dentro)
POST /api/orders/[id]/payments/[paymentId]/siigo-receipt → LOG → siigo-vouchers (recibo de pago Siigo)
GET/POST …/siigo-receipt/legacy-{context,assignment} → admin → asignación histórica
GET  /api/orders/[id]/siigo-invoice/context · POST /api/orders/[id]/siigo-invoice → LOG → siigo-invoices (factura Siigo; gated por `NUXT_SIIGO_INVOICE_WRITES_ENABLED`)
GET/POST/DELETE …/siigo-invoice/legacy-{context,assignment} → admin
GET  /api/siigo/invoices · /invoices/[id] · /vouchers · /summary → LOG

### Catálogo Siigo (productos y terceros)
GET  /api/siigo/products · /[id] → ENT → stored-products (PostgreSQL), siigo-catalog
POST /api/siigo/products · PUT /[id] · PATCH /[id]/active · PUT|DELETE /[id]/image → PROD → managed-products, product-images
GET  /api/siigo/products/context · /sat → PROD
POST /api/siigo/products/{recover,retry-write,discard-write,write-review} → PROD → managed-products (escrituras pendientes `product_writes`)
GET  /api/products/[id]/cost → PROD → product-costs · /activity → por sección → product-activity
GET  /api/siigo/customers · /[id] · POST · PUT /[id] · PATCH /[id]/invoice-requirement · POST /sync → ENT → siigo-customers, siigo-customer-sync, siigo-customer-import
PATCH /api/siigo/customers/[id]/roles → LOG → siigo-customer-repository

### Compras — `purchases.ts`, `purchase-domain.ts`
GET|POST /api/purchases · GET /api/purchases/[id] · POST /api/purchases/[id]/actions → admin → (recepciones → inventory.receiveInventory; pagos → expenses)

### Inventario — `inventory.ts` (500 l)
GET  /api/inventory/[resource] → INVR (counts/movements: INVW) → listInventory
POST /api/inventory/actions → INVW → executeInventory (movimientos, conteos, traspasos, almacenes)
GET  /api/inventory/summary → admin,consulta
GET  /api/inventory/valuation → admin → inventoryValuation

### Gastos, repartidores, reportes
GET|POST /api/expenses · PUT|DELETE /api/expenses/[id] → LOG → expenses
GET  /api/repartidores → ENT · POST, GET /[id] → LOG → repartidores
GET  /api/dashboard/summary → LOG → dashboard-period
GET  /api/reports/summary → admin → reports (sales_orders, payments, expenses, purchase_invoices)

## server/utils (agrupado)
Siigo API: siigo.ts (OAuth en memoria, `siigoRequest`), siigo-errors, siigo-catalog (caché), siigo-products, siigo-product-sat, siigo-product-sync, siigo-persistence (upsert local), siigo-customers*, siigo-order-customer, siigo-invoices, siigo-invoice-reconciliation, siigo-vouchers
Pedidos: orders, order-validation (Zod), order-payments, order-recipe-units, customer-balance, customer-validation
Productos: managed-products, stored-products, product-catalog-persistence, product-compositions (recetas), product-costs, product-images (Supabase Storage), product-activity, product-unit
Compras/inventario: purchases, purchase-domain, inventory, inventoryValuation
Otros: expenses, repartidores, repartidor-validation, reports, dashboard-period, ticket-printer, prisma, supabase, auth

## shared/
schemas/{inventory,product,purchase}.ts (Zod) · types/{inventory,ticket,customerBalance,product-activity} · utils/{datetime (MEXICO_TIME_ZONE), orderAmounts, paymentMethods (SAT), purchaseTotals, siigoReceiptDates, ticketEscpos, businessInfo}

## Pruebas
`vitest run`: tests/unit (≈70), tests/nuxt (≈60, componentes). BD real: `test:inventory-db`, `test:purchases-db` → tests/integration.
