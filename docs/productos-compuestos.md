# Productos y productos compuestos

Decisiones confirmadas por el usuario el 18/10/2026:

- Siigo conserva los datos comerciales y fiscales. Las altas y ediciones envían exclusivamente `type: Product`, `stock_control: false`, precios propios, impuestos, unidad y clave SAT. La composición interna no se envía a Siigo. El contrato de creación está documentado en [Siigo México](https://developers.siigo.com/docs/siigoapimexico/productos/1-create-product/).
- PostgreSQL distingue `product` y `composite` mediante `siigo_products.internal_kind`. `product_components` referencia los productos simples que consume cada unidad vendida, con cantidad decimal positiva de hasta seis decimales. No hay anidación, auto-referencias, cantidades cero ni componentes duplicados.
- Las cantidades se capturan en unidades del producto base: `0.25`, `0.5` y `6` significan esas cantidades del producto seleccionado. No se realizan conversiones de litros o de presentaciones.
- Cada componente debe estar activo, ser un producto simple y tener control de inventario interno. El compuesto no tiene existencias, compras, entradas ni conteos propios.
- Los combos y servicios externos permanecen consultables para el historial. No aparecen en la selección para nuevas ventas; el servidor también rechaza el intento de usarlos en pedidos nuevos. Las cotizaciones históricas deben reemplazarlos antes de convertirse en venta.

## Pedidos e inventario

Al crear cada partida se guarda `sales_order_items.inventory_recipe`: identificador, código, nombre, unidad y cantidad por unidad del producto vendido. Esta copia se conserva al editar el pedido y su cantidad. Un producto agregado después recibe su propia copia vigente. Los pedidos anteriores a la migración mantienen su consumo directo; no se les infiere retrospectivamente una composición.

Al confirmar se reservan los componentes, sin descontar aún las existencias. Al surtir, enviar o entregar se libera la reserva y se registra una sola salida de los componentes. Una venta de mostrador que nace entregada aplica el mismo consumo una sola vez. El compuesto permanece como partida comercial y de factura, con su precio propio.

Antes de activar globalmente el inventario se pueden guardar cotizaciones con compuestos. Sus confirmaciones y surtidos (incluyendo la entrega directa de mostrador) se rechazan sin registrar reservas, salidas ni pagos. Esas cotizaciones conservan su obligación de inventario y, después de activarlo, reservan y descuentan su composición original. La misma regla aplica al agregar un compuesto a una cotización anterior. Los pedidos históricos sin compuestos conservan el comportamiento anterior a la activación.

La factura omite `items.warehouse` cuando el producto no tiene control de inventario en Siigo; enviar una bodega en ese caso provoca el error [product_settings](https://developers.siigo.com/docs/siigoapimexico/codigos-de-error/#product_settings). Para productos históricos que todavía conservan control externo se mantiene el campo si se selecciona una bodega.

Las demandas se agrupan por producto base, incluso si aparece en varios compuestos y también se vende directamente. Los saldos se bloquean en el orden existente y el pedido entero se revierte si falta cualquier componente. Los consumos con más de seis decimales se rechazan para evitar redondeos silenciosos. La vista de inventario del pedido muestra los componentes de su copia histórica.

Cancelar antes del surtido libera reservas. Cancelar después del surtido conserva la salida: la devolución explícita existente restituye cantidades de los componentes realmente surtidos. Cambiar una composición no modifica pedidos anteriores. No se puede desactivar el control interno de un producto requerido por una composición o por un pedido compuesto abierto.

El tipo de un producto existente se puede cambiar cuando no tiene existencias, reservas, conteos pendientes, compras pendientes de recepción ni pedidos abiertos que dependan de él, y no es componente de otros productos. El control de versión rechaza ediciones obsoletas.

## Guardados y conciliación

Siigo y PostgreSQL no comparten una transacción. Antes de enviar una mutación se guarda su intención en `product_writes`. Solo después de confirmar la respuesta se persisten el producto, la composición y el cierre de la operación en una transacción local. Un guardado con timeout, respuesta ambigua o fallo del commit queda `pending`/`unknown`. Su identificador y el código impiden otra escritura y excluyen el producto de ventas y de movimientos de inventario mientras se resuelve.

Los errores de consulta o validación anteriores al envío a Siigo cierran el intento como `failed`, incluso si son `5xx` o timeout: no hubo escritura remota y el usuario puede volver a guardar manualmente. Solo una escritura enviada cuyo resultado sea incierto, o un fallo local posterior a su confirmación, mantiene el bloqueo de conciliación.

La acción **Consultar y conciliar guardado** consulta Siigo sin repetir la mutación. Verifica un resultado único y la coincidencia de los datos comerciales enviados; después completa la composición local. Ante diferencias o ausencia del producto mantiene el bloqueo e informa del problema. No se reintenta automáticamente una escritura remota.

La acción **Desbloquear edición** permite cerrar explícitamente un intento de edición antiguo y conservar los datos actuales. Consulta Siigo antes de cerrar el intento como `failed`, conserva el registro y no aplica su composición ni disponibilidad pendientes. Solo admite ediciones del mismo producto con al menos cinco minutos de antigüedad; revalida el estado bajo bloqueo para no competir con una conciliación en curso. El formulario conserva las correcciones aún no guardadas. Los intentos cerrados no se pueden volver a conciliar.

Solo los administradores pueden guardar o conciliar productos. Las tablas nuevas tienen RLS y no conceden acceso directo a `anon` o `authenticated`; el servidor aplica los permisos existentes. Los componentes locales están separados de los snapshots externos, por lo que recargar Siigo conserva las composiciones y los costos locales.

## Verificación y migración

La migración es `supabase/migrations/20261018190553_internal_product_compositions.sql`. Se aplica localmente con `supabase migration up --local`. No convierte tipos externos ni modifica pedidos históricos.

Las pruebas de integración crean y eliminan únicamente una base temporal en PostgreSQL local y simulan la frontera Siigo. Cubren kits y fracciones, composición histórica, edición, faltantes, concurrencia, devoluciones, bloqueo de anidados, cambio de tipo, acceso directo, fallos externos y recuperación después de fallos locales. Las pruebas de contrato verifican que el payload de Siigo no incluya la composición interna. La verificación en Chrome utiliza la sesión autenticada del usuario sin crear productos de prueba en Siigo ni documentos fiscales.

## Disponibilidad interna por operación

Cada producto tiene opciones independientes de **Compra**, **Venta directa** y **Gasto** en su edición. La migración `20261020160134_internal_product_availability.sql` inicializa las tres en `true` para conservar el comportamiento de los productos existentes. Pueden desactivarse todas si el producto solo se usa como componente.

Estas opciones se guardan en columnas locales de `siigo_products`; los snapshots y recargas de Siigo no las sobrescriben y nunca se envían en su payload. Si solo cambia información interna y el producto ya está configurado sin control de inventario externo, el guardado no realiza ninguna mutación en Siigo.

Los selectores de ventas, compras y gastos consultan `usage=sale|purchase|expense`. Se filtra antes de paginar. Las compras siguen admitiendo únicamente productos simples. La edición administrativa y los selectores de composición e inventario conservan acceso a los productos independientemente de estas opciones.

El servidor rechaza productos sin venta directa en partidas nuevas y al convertir una cotización en venta; una partida histórica existente puede conservarse al editar el pedido. La disponibilidad de venta del componente no afecta la receta del compuesto. Compras valida disponibilidad al crear, editar, confirmar y recibir. Gastos permite asociar opcionalmente un producto habilitado, conservando asociaciones históricas al editar. Esta asociación no registra movimientos de inventario.

Aplicar la migración también en el entorno de despliegue antes de publicar este cambio.
