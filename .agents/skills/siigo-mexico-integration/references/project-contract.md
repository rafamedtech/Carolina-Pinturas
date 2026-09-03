# Contrato del proyecto Carolina Pinturas

## Índice

1. Arquitectura y alcance
2. Puntos de extensión
3. Autenticación y configuración
4. Reglas de dominio
5. Evidencia observada
6. Estrategia de pruebas

## 1. Arquitectura y alcance

- Usar Nuxt 4 + Nuxt UI 4 con SSR.
- Considerar Siigo como fuente de verdad de productos y clientes.
- Mantener pedidos internos en PostgreSQL/Supabase mediante Prisma.
- No buscar ni inventar un recurso de pedidos en Siigo México. Los pedidos siguen siendo internos.
- Por decisión explícita del usuario del 2026-07-28, un pedido marcado con `requiresInvoice` puede crear, mediante una acción confirmada y separada, una factura borrador en Siigo con `stamp.send: false` y `mail.send: false`. Los demás pedidos no crean documentos en Siigo.
- Por decisión explícita del usuario del 2026-08-28, todos los pagos se registran primero y únicamente como pagos locales en `sales_order_payments` de PostgreSQL, independientemente de que el pedido requiera o ya tenga factura. El núcleo local no exige RFC ni factura.
- Cuando el pedido ya tiene una factura PPD asociada, cada pago local muestra una acción explícita e individual para crear una recepción borrador en Siigo mediante `/v1/vouchers`; no se agrupan pagos y la recepción no se timbra ni se envía automáticamente al SAT.
- Por decisión explícita del usuario del 2026-08-28, la acción para registrar un pago en Siigo permanece deshabilitada hasta que la factura asociada devuelva `stamp.status: Accepted`; el servidor vuelve a validar este estado antes de crear la recepción.
- Cada alta de pago local exige un `requestId` UUID único. Al solicitar la recepción, el mismo registro se reserva antes de llamar a Siigo y conserva un estado `pending`, `synced`, `failed` o `unknown`; nunca se crea un segundo pago ni se reintenta automáticamente una respuesta fiscal ambigua.
- Por decisión explícita del usuario del 2026-08-28, un administrador puede detectar recepciones previamente creadas en Siigo para la factura del pedido y vincular una recepción compatible a un pago local. Esta conciliación revalida factura, cliente, fecha e importe y sólo actualiza PostgreSQL; no crea ni modifica documentos en Siigo.
- Por decisión explícita del usuario del 2026-09-03, si esa conciliación no encuentra una recepción compatible, el administrador puede confirmar la creación de la recepción desde el pago local y su timbrado inmediato. La aplicación persiste el identificador creado antes de timbrar, no reintenta resultados ambiguos y exige un correo válido requerido por Siigo.
- Una venta de mostrador puede crear un pago inicial completo aunque requiera factura. El navegador envía únicamente `requestId`, método y fecha; el servidor calcula el total definitivo y guarda pedido y pago local en la misma transacción. Esta opción se rechaza para repartidores distintos de Mostrador.
- Volver a consultar cliente y productos en Siigo al guardar un pedido; no confiar en el payload del navegador.
- Por decisión explícita del usuario del 2026-08-27, el catálogo y el detalle vigente de clientes se consultan desde Siigo. PostgreSQL conserva la referencia necesaria para pedidos y las preferencias internas, pero no el domicilio actual. La caché corta del catálogo evita exceder límites y la acción **Recargar** la invalida explícitamente.
- Por decisión explícita del usuario del 2026-08-31, los gastos se registran únicamente en PostgreSQL. Cada gasto referencia un tercero que debe ser `Supplier` en Siigo y tener `is_supplier` en `siigo_customers`, conserva snapshots históricos del proveedor y no crea documentos en Siigo.
- Evidencia observada el 2026-08-31: Siigo Nube permite seleccionar simultáneamente Customer y Supplier, pero la API México devuelve esa combinación únicamente como `type: Supplier`. Conservar membresías independientes mediante `is_customer` e `is_supplier` en PostgreSQL; el enum externo inicializa registros nuevos, pero después no debe sobrescribir la clasificación local.
- El cliente `MOSTRADOR .` se resuelve desde el catálogo de Siigo compartido y cacheado; al guardar un pedido se conserva la consulta puntual del cliente en Siigo.
- Conservar snapshots históricos e `raw_payload` para tolerar cambios futuros del contrato externo.

## 2. Puntos de extensión

Inspeccionar antes de modificar:

- `server/utils/siigo.ts`: configuración, token, timeout, solicitud común y query de listados.
- `server/utils/siigo-errors.ts`: extracción de mensajes de error.
- `server/utils/siigo-customers.ts`: payload y normalización de clientes.
- `server/api/siigo/**`: fronteras HTTP protegidas del proyecto.
- `app/types/siigo.ts`: vistas tipadas y deliberadamente tolerantes de respuestas externas.
- `server/utils/siigo-persistence.ts` y `server/utils/orders.ts`: persistencia y snapshots.
- `tests/unit/siigo-*.test.ts` y `tests/nuxt/**`: evidencia de contrato y regresiones.
- `scripts/smoke-siigo-customer.mjs`: prueba manual destructiva; auditarla contra la implementación actual antes de usarla.

Usar rutas H3 con sufijo de verbo, `requireRole`/`requireUser` en servidor y permisos centralizados en `app/utils/roleAccess.ts`. No considerar los controles del frontend como autorización suficiente.

## 3. Autenticación y configuración

Variables privadas existentes:

- `NUXT_SIIGO_API_URL`, predeterminada a `https://api.siigo.mx`.
- `NUXT_SIIGO_USERNAME`.
- `NUXT_SIIGO_ACCESS_KEY`.
- `NUXT_SIIGO_APPLICATION_ID`, predeterminada a `CarolinaPinturas`.

No leer ni mostrar valores de `.env` para una revisión normal. Verificar solo presencia o nombres cuando sea necesario.

`siigoConfigured()` debe bloquear rutas cuando falte configuración. El token se obtiene en `/auth`, se guarda solo en memoria y se renueva aproximadamente una hora antes de sus 24 horas documentadas. El encabezado `SiigoAPI-Application-Id` debe identificar la integración con 3–100 caracteres alfanuméricos sin espacios.

## 4. Reglas de dominio

- Mantener productos y clientes disponibles para roles de captura definidos por `ORDER_ENTRY_ROLES`.
- Mantener facturas y pagos bajo roles logísticos definidos por el proyecto.
- Preservar el estado explícito de Siigo no configurado; no introducir datos simulados como fallback.
- Por decisión explícita del usuario del 2026-08-18, la creación confirmada de facturas borrador puede habilitarse con `NUXT_SIIGO_INVOICE_WRITES_ENABLED=true`; las recepciones de pago permanecen separadas y deshabilitadas hasta autorización explícita mediante `NUXT_SIIGO_FISCAL_WRITES_ENABLED`.
- Obtener IDs dependientes del tenant desde endpoints de catálogo, nunca desde ejemplos del blueprint.
- Respetar el límite oficial publicado de 150 solicitudes por minuto y 5.000 por día. Evitar fan-out sin control; revisar especialmente listados completos y enriquecimiento N+1.

## 5. Evidencia observada

Dar prioridad a estas regresiones locales frente a ejemplos contradictorios:

- El 2026-07-06 Siigo México rechazó `contacts` como objeto con `Invalid data type: contacts`; `CustomerIn` requiere arreglos para `contacts` y `phones`.
- El 2026-08-18 Siigo México rechazó `payment.conditions` como objeto con `Invalid data type: conditions`; `PaymentIn` exige `conditions` como arreglo aun cuando la tabla descriptiva de creación muestre campos singulares.
- El 2026-08-18 Siigo calculó $1,922.40 para una partida local de $1,780 con IVA 8% incluido: `items.price` debe recibir la base antes de impuestos cuando también se envía `items.taxes`, o el impuesto se duplica y deja de coincidir con `payment.conditions[].value`.
- Por decisión explícita del usuario del 2026-08-18, al pulsar **Facturar** se consulta `GET /v1/invoices/{id}` cuando existe una factura local marcada como creada. Sólo un `404` confirma que fue eliminada en Siigo y permite volver a crear el borrador; errores de red, autorización o servidor mantienen el bloqueo para evitar duplicados.
- Por decisión explícita del usuario del 2026-08-28, si no existe una factura vigente, **Facturar** consulta el cliente actual en Siigo y exige únicamente que esté activo y tenga un RFC fiscal válido no genérico. La factura referencia el RFC y la sucursal; no envía el domicilio ni actualiza al cliente. Cualquier corrección del domicilio se realiza previamente en Siigo y después se vuelve a consultar desde el proyecto.
- Por decisión explícita del usuario del 2026-08-18, el formulario de factura selecciona por defecto el método cuyo nombre de catálogo corresponde a **Efectivo** y al vendedor **Alexis Cordova**. Resolver siempre sus IDs desde los catálogos del tenant y conservar el primer elemento disponible como respaldo.
- Por decisión explícita del usuario del 2026-08-18, todo pedido no borrador muestra la acción **Facturar** para los roles logísticos. Al pulsarla, si `requiresInvoice` todavía es falso, actualizar primero el pedido en PostgreSQL con control de versión y sólo después iniciar la validación y creación en Siigo.
- Por decisión explícita del usuario del 2026-08-18, `siigo_customers.requires_invoice` es una preferencia interna que no se envía a Siigo. Al seleccionar ese cliente en un pedido nuevo, inicializa `requiresInvoice`; el usuario puede modificar el valor para ese pedido sin cambiar la preferencia del cliente.
- La respuesta de cliente puede devolver `name` como `string`, `string[]` o vacío. Normalizar a `string[]` y exigir `id` y un nombre utilizable.
- Para `Physical`, enviar nombres y apellidos separados. El código existente envía un solo `string` para `Moral` y `Foreign`; conservar esta decisión mientras las pruebas/evidencia la respalden.
- La dirección de creación usa `address.address`, aunque algunas descripciones del blueprint llaman al campo de entrada `street`. Preservar el payload comprobado y documentar el conflicto.
- Los errores pueden usar `Errors` o `errors`, y `Message` o `message`.
- El 2026-07-17 producción registró errores Prisma `P2028` al crear/editar pedidos: la sincronización secuencial de precios, impuestos, bodegas y componentes agotaba el timeout interactivo predeterminado de 5 segundos. Conservar los upserts anidados de snapshots en `siigo-persistence.ts` y las opciones acotadas de transacción de escritura; no reintroducir `deleteMany`/`createMany` separados por relación dentro del pedido.
- El 2026-07-17 los catálogos tenían 708 productos activos y 317 clientes. Cargarlos con páginas de 25 generaba 42 solicitudes por apertura. Siigo México aceptó `page_size=100`; conservar ese tamaño, la caché corta y la deduplicación de cargas concurrentes. Ante `429` o `5xx`, reutilizar solamente un catálogo previamente obtenido; no ocultar `401` u otros errores permanentes.
- Al desplegar `sales_order_payments`, migrar cada pedido histórico con `payment_status = 'pago_recibido'` a un pago local por el total del pedido, conservando su método y fecha actuales. El backfill debe ser idempotente y no inferir importes parciales para pedidos `abonado`, porque el modelo anterior no almacenaba el monto del abono.

El script de smoke incluido en el repositorio puede quedarse atrás respecto del constructor probado. Comparar su payload con `buildSiigoCustomerPayload()` antes de ejecutarlo; no asumir que un script manual es la fuente más reciente.

## 6. Estrategia de pruebas

- Probar constructores de payload con campos mínimos, opcionales, límites y formas por tipo de persona.
- Probar normalizadores contra variantes y respuestas incompletas.
- Probar errores en mayúsculas/minúsculas, timeout, `401`, `429` y `5xx` sin exponer secretos.
- Mockear `$fetch` o la frontera `siigoRequest` para pruebas automáticas.
- Para paginación, probar primera página, múltiples páginas, resultados vacíos y metadatos ausentes.
- Para una prueba real de escritura, exigir tenant no productivo, confirmación explícita y plan de reversión/desactivación.
