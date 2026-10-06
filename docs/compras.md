# Compras internas

Módulo `/compras`, exclusivo de administradores. Siigo aporta catálogo y validación vigente de proveedores/productos. Órdenes, recepciones, facturas del proveedor, abonos e historial permanecen en PostgreSQL. Las recepciones no actualizan existencias en Siigo.

## Puesta en servicio

Aplicar `supabase/migrations/20260916211107_add_purchases.sql` mediante el procedimiento habitual de migraciones **antes** de desplegar el nuevo servidor. Regenerar Prisma (`pnpm db:generate`). La migración es aditiva; no transforma gastos históricos. Migración aplicada y verificada en el proyecto Supabase de producción `xirmbnxgaflcnqlzagqc` durante la activación autorizada.

Las siete tablas nuevas tienen RLS y carecen de permisos para `anon` y `authenticated`. El acceso pasa por las rutas servidor, que consultan el rol interno. Los gastos derivados solo aparecen para administradores, incluidos conteos, sumas SQL y dashboard.

## Operación

1. Crear borrador con proveedor Supplier activo, productos vigentes y costos finales con impuestos. Guardar cambios antes de confirmar; confirmar congela proveedor y partidas.
2. Registrar recepciones completas o parciales. Actualizar existencias manualmente en Siigo.
3. Capturar cada factura del proveedor con folio, importe real y vencimiento. Puede registrarse antes de recibir mercancía. La aplicación muestra diferencias entre importe ordenado y facturado.
4. Registrar abonos únicamente contra una factura vigente. Cada abono genera un gasto por el mismo importe y moneda, con su tipo de cambio a MXN; registrar la factura no genera gasto.
5. Para corregir, anular abono con motivo: elimina su gasto vinculado, conserva pago e historial y restaura saldo. No se editan gastos vinculados desde Gastos. Facturas sin pagos vigentes pueden editarse o anularse. Recepciones anuladas dejan de contar como recibidas.

Una factura vigente no puede repetir folio para el mismo proveedor (comparación sin distinguir mayúsculas). La cancelación de orden exige que no queden recepciones ni facturas vigentes. Fechas usan la zona horaria del proyecto y selector reutilizable Nuxt UI.

## API y concurrencia

- `GET /api/purchases`: listado con `search` (proveedor), `dateFrom`, `dateTo`, `status`.
- `GET /api/purchases/:id`: detalle, saldos e historial.
- `POST /api/purchases`: `{ requestId, draft }`.
- `POST /api/purchases/:id/actions`: `{ requestId, version, command }`; esquemas en `shared/schemas/purchase.ts`.

Todas las escrituras sobre una orden adquieren el mismo bloqueo transaccional mediante actualización condicional de versión. Repetir una solicitud idéntica devuelve el estado actual; reutilizar su UUID con datos distintos produce conflicto. Consultas Siigo ocurren antes de abrir la transacción. No existen llamadas de escritura a Siigo.

## Validación

- `pnpm test`: pruebas unitarias, autorización y regresiones del proyecto.
- `PURCHASE_TEST_DATABASE_URL=postgresql://USUARIO@127.0.0.1:55439/postgres pnpm test:purchases-db`: siete escenarios contra PostgreSQL desechable con esquema migrado; Siigo simulado. El runner rechaza destinos fuera de localhost y puerto 55439. No usa `DATABASE_URL` ni credenciales Siigo. Crea y limpia sus registros de prueba.
- `pnpm lint`, `pnpm typecheck`, `pnpm db:validate`, `pnpm build`.

Verificado en Chrome del usuario con copia temporal aislada y PostgreSQL local: crear/confirmar orden, recepción parcial, factura, abono, gasto vinculado, bloqueo de edición, cuentas por pagar agrupadas, anulación y diseño de impresión. Los reemplazos de autenticación y catálogo de esa copia temporal no forman parte del repositorio.

### Costo vigente por producto

El saldo inicial y los conteos aplicados antes de activar el inventario permiten capturar el costo unitario con impuestos y su moneda (MXN o USD), con hasta seis decimales. Es un costo por producto: debe coincidir al cargar el mismo producto en varios almacenes. Se conserva por separado como costo inicial.

Al registrar una recepción, el costo vigente se obtiene de la última recepción no anulada de una orden confirmada que contenga ese producto. Se ordenan por fecha de recepción, fecha de registro e identificador; por eso cargar una recepción con fecha anterior no sustituye una más reciente. Borradores, confirmaciones, facturas, pagos, devoluciones y movimientos manuales posteriores no cambian el costo. La actualización ocurre en la misma transacción que la recepción, incluso antes de activar el inventario.

Anular una recepción recalcula el costo a partir de las recepciones vigentes; sin ellas, restaura el costo inicial. Se guarda y muestra la moneda original, sin conversión. La migración recupera costos de recepciones existentes; los productos sin compras recibidas ni costo inicial permanecen sin costo, pues no se infiere del precio de venta.
