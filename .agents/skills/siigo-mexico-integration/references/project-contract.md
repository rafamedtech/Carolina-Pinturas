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
- No buscar ni inventar un recurso de pedidos en Siigo México. Crear o modificar un pedido nunca debe crear una factura ni otro documento fiscal en Siigo.
- Volver a consultar cliente y productos en Siigo al guardar un pedido; no confiar en el payload del navegador.
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
- Mantener deshabilitadas operaciones fiscales de escritura hasta validar el contrato en un entorno seguro.
- Obtener IDs dependientes del tenant desde endpoints de catálogo, nunca desde ejemplos del blueprint.
- Respetar el límite oficial publicado de 150 solicitudes por minuto y 5.000 por día. Evitar fan-out sin control; revisar especialmente listados completos y enriquecimiento N+1.

## 5. Evidencia observada

Dar prioridad a estas regresiones locales frente a ejemplos contradictorios:

- El 2026-07-06 Siigo México rechazó `contacts` como objeto con `Invalid data type: contacts`; `CustomerIn` requiere arreglos para `contacts` y `phones`.
- La respuesta de cliente puede devolver `name` como `string`, `string[]` o vacío. Normalizar a `string[]` y exigir `id` y un nombre utilizable.
- Para `Physical`, enviar nombres y apellidos separados. El código existente envía un solo `string` para `Moral` y `Foreign`; conservar esta decisión mientras las pruebas/evidencia la respalden.
- La dirección de creación usa `address.address`, aunque algunas descripciones del blueprint llaman al campo de entrada `street`. Preservar el payload comprobado y documentar el conflicto.
- Los errores pueden usar `Errors` o `errors`, y `Message` o `message`.
- El 2026-07-17 producción registró errores Prisma `P2028` al crear/editar pedidos: la sincronización secuencial de precios, impuestos, bodegas y componentes agotaba el timeout interactivo predeterminado de 5 segundos. Conservar los upserts anidados de snapshots en `siigo-persistence.ts` y las opciones acotadas de transacción de escritura; no reintroducir `deleteMany`/`createMany` separados por relación dentro del pedido.
- El 2026-07-17 los catálogos tenían 708 productos activos y 317 clientes. Cargarlos con páginas de 25 generaba 42 solicitudes por apertura. Siigo México aceptó `page_size=100`; conservar ese tamaño, la caché corta y la deduplicación de cargas concurrentes. Ante `429` o `5xx`, reutilizar solamente un catálogo previamente obtenido; no ocultar `401` u otros errores permanentes.

El script de smoke incluido en el repositorio puede quedarse atrás respecto del constructor probado. Comparar su payload con `buildSiigoCustomerPayload()` antes de ejecutarlo; no asumir que un script manual es la fuente más reciente.

## 6. Estrategia de pruebas

- Probar constructores de payload con campos mínimos, opcionales, límites y formas por tipo de persona.
- Probar normalizadores contra variantes y respuestas incompletas.
- Probar errores en mayúsculas/minúsculas, timeout, `401`, `429` y `5xx` sin exponer secretos.
- Mockear `$fetch` o la frontera `siigoRequest` para pruebas automáticas.
- Para paginación, probar primera página, múltiples páginas, resultados vacíos y metadatos ausentes.
- Para una prueba real de escritura, exigir tenant no productivo, confirmación explícita y plan de reversión/desactivación.
