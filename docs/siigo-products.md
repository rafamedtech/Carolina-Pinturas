# Gestión de productos — Siigo México

## Alcance y permisos

Administradores crean y actualizan productos, servicios y bienes de consumo, incluyendo precios, impuestos y estado. Los roles de captura conservan consultas. Pedidos nuevos rechazan productos inactivos; pedidos existentes conservan sus referencias. No hay borrado, ajustes de existencias ni edición de componentes.

Las mutaciones usan `siigoRequest` exclusivamente en servidor. Ante timeout o respuesta inválida posterior al envío, no se reintenta ni se anuncia éxito: la interfaz ofrece consultar el resultado por ID o código antes de iniciar otra edición. No existe garantía de idempotencia de Siigo para productos.

## Catálogos SAT

`server/assets/sat/catalog.json` contiene 52,513 claves y 2,418 unidades, publicadas por Siigo México. Cada catálogo conserva URL de fuente y SHA-256 del XLSX/XLSM original; `retrievedAt` es fecha de descarga, no fecha de publicación ni certificación de vigencia del SAT. Nitro empaqueta el archivo como asset de servidor; el navegador recibe páginas de 25 coincidencias.

Actualizar con Python 3 (solo biblioteca estándar):

```sh
python3 scripts/update-sat-products.py
```

Para reproducir desde descargas previas, pasar `--source-dir` con `siigo-claves.xlsx` y `siigo-unidades-sat.xlsm`. Revisar fuente, conteos y diferencias antes de publicar; desplegar para cargar la nueva versión. Un código histórico se puede conservar al editar el mismo producto aunque ya no esté en el catálogo incluido.

## Evidencia del 2026-09-15

- Contrato de [creación](https://developers.siigo.com/docs/siigoapimexico/productos/1-create-product/) y [actualización](https://developers.siigo.com/docs/siigoapimexico/productos/2-edit-product): tipos `Product`, `Service`, `ConsumerGood`.
- El catálogo real incluye `Combo` y componentes con identificador numérico. Se normaliza el identificador a texto para consulta. La escritura de tipos no documentados se bloquea expresamente; nunca convertir un combo a producto para eludir esa restricción.
- El archivo `unidades de medida.xlsx` enlazado en la web de Siigo solo trae 1,089 registros y omite `H87`. Se usa `Unidades de medida SAT.xlsm`, enlazado en el blueprint México: contiene `H87` (Pieza) y 2,418 registros.
- `key` puede llegar como texto; se normaliza a `{ code }`. Unidades vacías del listado se enriquecen desde detalles con un máximo de cuatro consultas simultáneas y caché compartida.
- Listas de precios usan `position` para escribir, no el `id` del catálogo.
- El formulario no expone `model`, `tariff`, `tax_classification` ni `tax_consumption_value`; se conservan desde una lectura vigente y se incluyen solo cuando existen. No se envían cantidades, bodegas, metadatos ni componentes.

## Verificación

Pruebas unitarias y de rutas cubren validación, permisos, filtros, SAT, normalización, preservación de payload, caché y errores ambiguos. Pruebas Nuxt cubren formulario, monedas, errores, calendarios y doble envío. Se verificaron consultas de catálogo y buscadores en Chrome con sesión existente. Las escrituras se prueban con mocks; no se crean datos de prueba en el tenant real.

## Imágenes de producto

Siigo México no expone imagen de producto (verificado contra listado y detalle reales el 2026-09-15). La imagen es dato propio de la app:

- Archivo en el bucket público `product-images` de Supabase Storage, ruta `{productId}/{uuid}.{ext}`. Cada subida usa ruta nueva, así la URL pública es inmutable y cacheable; la anterior se borra tras guardar.
- Registro en `public.product_images` (Prisma `ProductImage`), llave = ID de Siigo. El detalle (`GET /api/siigo/products/:id`) la agrega en `internal.image`.
- Solo `PRODUCT_MANAGEMENT_ROLES` sube (`PUT /api/siigo/products/:id/image`, multipart campo `image`) o quita (`DELETE`). El servidor valida la firma del archivo (JPG, PNG, WebP), máximo 2 MB, y que el producto exista en Siigo.
- Storage no tiene políticas para `anon`/`authenticated`: escribe solo el servidor con `NUXT_SUPABASE_SECRET_KEY` (llave `sb_secret_`, nunca `NUXT_PUBLIC_*`) después de `requireRole`.
- Se sube desde la edición del producto; en el detalle solo se muestra si existe. Un producto nuevo recibe imagen después de crearse.
