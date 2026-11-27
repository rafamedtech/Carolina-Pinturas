<!-- Generado: 2026-11-27 | commit: aa2a705 | archivos: nuxt.config.ts, .env.example, server/utils/siigo*.ts -->
# Integraciones — siigo-pinturas

## Variables de entorno (solo nombres)
NUXT_PUBLIC_SITE_URL, NUXT_PUBLIC_SUPABASE_URL, NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — públicas
NUXT_SUPABASE_SECRET_KEY — servidor (Storage de imágenes, administración)
NUXT_SIIGO_API_URL, NUXT_SIIGO_USERNAME, NUXT_SIIGO_ACCESS_KEY, NUXT_SIIGO_APPLICATION_ID — servidor
NUXT_SIIGO_INVOICE_WRITES_ENABLED, NUXT_SIIGO_FISCAL_WRITES_ENABLED — interruptores de escrituras fiscales
DATABASE_URL (pooler 6543), DIRECT_URL (5432)

## Siigo México API
`server/utils/siigo.ts`: OAuth (username + access_key) con token en memoria; encabezado `SiigoAPI-Application-Id`. `siigoConfigured()` condiciona cada ruta; sin configuración la UI muestra estado de conexión.
- Lectura: productos (sincronizados a `siigo_products` al pulsar Actualizar/facturar/editar), terceros, facturas, comprobantes, catálogo SAT.
- Escritura: productos y terceros (admin), facturas de pedido y recibos de pago (LOG) — solo con interruptores activos. Siigo no tiene recurso de pedidos: los pedidos viven solo en PostgreSQL.
- Docs: `docs/siigo-products.md`, `docs/siigo-payments.md`; skill `.agents/skills/siigo-mexico-integration`.

## Supabase
Auth (cookies SSR, `/auth/callback`), Storage (bucket de imágenes de producto), PostgreSQL. Local en puertos 55320–55329 (`pnpm db:start`).

## Impresión de tickets
Red: `server/utils/ticket-printer.ts` (direcciones permitidas) · Bluetooth/navegador: `useBluetoothPrinter`, `shared/utils/ticketEscpos.ts`.

## CVRTRANSPORT lee esta base (solo SELECT, clave secreta)
- sales_orders: id, order_date, total, tax_total, customer_id, customer_name_snapshot, status_key
- sales_order_items: id, order_id, product_name_snapshot, total, tax_amount, quantity, product_id
- sales_order_payments: id, order_id, payment_date, payment_method, amount
- siigo_customers: is_internal_order_customer · siigo_products: account_group_name, unit_cost, cost_currency
- expenses: id, expense_date, category, amount, exchange_rate, provider_name_snapshot, purchase_payment_id
- inventory_warehouses: id, code, name · inventory_balances: warehouse_id, product_id, quantity
Fuente: `CVRTRANSPORT/server/utils/carolina-{reports,inventory}.ts`. Contrato verificado en CI: `tests/contracts/cvr-carolina.json` + `tests/unit/cvr-carolina-contract.test.ts`.

## Capa `@rafamedtech/nuxt-shared`
Componentes Detail*/List*/Reports*/Auth*/App*, catálogo Siigo México (`2/4` en selector, `02/004` en payload). Ver `nuxt-shared/docs/CODEMAPS/`.

## Despliegue
Vercel. CI: `.github/workflows/ci.yml` (lint + typecheck), `db-migrate.yml` (migraciones Supabase).
