# Permisos y trazabilidad

Matriz operativa de Carolina Pinturas (CVR-02). La fuente única de permisos en código es `app/utils/roleAccess.ts`; cada ruta de `server/api` la aplica con `requireRole`. Los checks del cliente son solo UX.

## Matriz por flujo

C = consulta · R = registra · A = autoriza o revierte · — = sin acceso

| Flujo | admin | mostrador | vendedor | repartidor | igualaciones | consulta |
| --- | --- | --- | --- | --- | --- | --- |
| Pedidos y cotizaciones | R/A | R | R | R (estados de reparto) | C (cola de igualaciones) | C |
| Cobros de pedido | R/A | R | R | — | — | C |
| Gastos (sin abono de compra) | R/A | R | R | — | — | C |
| Compras: crear, editar, confirmar, cancelar | R/A | — | — | — | — | C |
| Compras: consultar y **registrar recepciones** | R | R (sin costos ni facturas) | — | — | — | C |
| Compras: anular recepción | A | — | — | — | — | — |
| Compras: historial por partida con costos (`/compras/historial`) | R | — | — | — | — | C |
| Facturas y abonos a proveedor, cuentas por pagar | R/A | — | — | — | — | C |
| Inventario: movimientos, conteos, traspasos | R/A | R | C | — | — | C |
| Catálogo de productos y precios | R/A | — | — | — | — | C |
| Corte de caja | Pendiente CVR-09 | | | | | |

Mostrador ve las compras con cantidades, recibido y recepciones; el servidor envía costos, totales, saldos, facturas y abonos en cero o vacíos (`purchaseViewForRole` en `server/utils/purchase-visibility.ts`). Es el mismo criterio que oculta a los roles operativos los gastos vinculados a abonos de compra.

El costo unitario de inventario es el último costo de compra, así que solo lo ven admin y consulta: `GET /api/inventory/*` elimina `unitCost`, `costCurrency`, `initialUnitCost` e `initialCostCurrency` para los demás roles (`inventoryForRole`). La tabla de existencias, el detalle de producto y el formulario de entradas ocultan el costo; el inventario inicial sigue pidiendo costo porque es obligatorio.

## Trazabilidad

Cada cambio que afecta saldo o inventario debe poder seguirse hasta su documento y su usuario, incluida su reversión.

| Registro | Dónde queda la traza |
| --- | --- |
| Compras, recepciones, facturas y abonos | `purchase_events` (acción, detalle, usuario, `request_id` idempotente) y `void_reason` en anulaciones |
| Movimientos de inventario | `inventory_events`, `inventory_movements` (`origin_key`, `reversal_of_id`); inmutables |
| Estados de pedido | `sales_order_status_history` |
| Cobros de pedido eliminados | `audit_events` (`entity_type = sales_order_payment`) con la foto previa |
| Gastos editados o eliminados | `audit_events` (`entity_type = expense`) con la foto previa y, al editar, el resultado |

`audit_events` es de solo inserción (trigger `private.audit_events_immutable`), con RLS activo y sin acceso para `anon`/`authenticated`. Se escribe en la misma transacción que el cambio con `recordAuditEvent` (`server/utils/audit.ts`).

Los cobros y gastos se siguen eliminando físicamente porque CVRTRANSPORT lee `sales_order_payments` y `expenses` sin filtro de anulación (`tests/contracts/cvr-carolina.json`). Cambiar a anulaciones lógicas requiere un cambio coordinado del contrato (previsto con CVR-06).
