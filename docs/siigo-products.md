# Gestión de productos — Siigo México

## Alcance y permisos

Administradores crean y actualizan productos simples y compuestos, incluyendo precios, impuestos, datos SAT y estado. Las altas se escriben en Siigo como `Product` con `stock_control: false`. Al editar o activar/desactivar un producto existente se conserva su `stock_control` vigente; no se convierte el control de inventario histórico. La composición se administra exclusivamente en PostgreSQL. Los roles de captura conservan consultas. Pedidos nuevos rechazan productos inactivos y tipos históricos (`Combo`, `Service`, `ConsumerGood`); los pedidos anteriores conservan sus referencias. No hay borrado. Consulta [Productos compuestos](./productos-compuestos.md) para las reglas de inventario y conciliación.

Las mutaciones usan `siigoRequest` exclusivamente en servidor. El guardado exige confirmación de los valores comerciales de Siigo antes de aplicar el producto y sus opciones internas en PostgreSQL. Ante un fallo no se anuncia éxito ni se repite automáticamente la escritura: se conserva el formulario y se permite volver a guardar manualmente. El siguiente intento consulta primero Siigo por ID o, para altas previamente fallidas, por código, para evitar repetir una operación ya aplicada. No existe garantía de idempotencia de Siigo para productos.

## Lectura local y sincronización explícita (26/10/2026)

El catálogo, sus filtros, detalles, marcas, precios y selectores se sirven desde `siigo_products` en PostgreSQL. Abrir Productos, cambiar filtros y guardar pedidos o compras no consulta productos en Siigo. La carga inicial usa `useFetch` con estado reactivo y termina al obtener los datos locales; no llama al manejador de Actualizar ni hace consultas adicionales por cada fila.

- **Actualizar** solicita `refresh=true`, descarga el catálogo completo de Siigo (incluidos inactivos), lo persiste y vuelve a consultar PostgreSQL. Los productos ausentes se desactivan localmente después de una descarga completa exitosa, conservando referencias históricas. No se desactivan productos cuya copia local se haya actualizado mientras la sincronización estaba en curso.
- **Facturar** valida y sincroniza solo los IDs de las partidas con un máximo de cuatro consultas simultáneas. Si un producto falta, está inactivo o cambió de código/tipo, se bloquea la factura. La comprobación automática al abrir un pedido no sincroniza productos. Antes de enviar la factura se repite la validación en servidor.
- **Crear, modificar y conciliar** conservan el flujo de escritura en Siigo y el guardado del snapshot en PostgreSQL. Las lecturas locales no intentan una sincronización implícita si falta un producto; se informa que hay que pulsar Actualizar.

La actualización conserva una unidad local conocida cuando el listado masivo de Siigo devuelve `unit: {}`. Las composiciones, disponibilidad por uso e inventario interno siguen siendo datos propios y no se sobrescriben al sincronizar.

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

Las decisiones del 18/10/2026 sustituyen la edición de servicios/bienes de consumo: se conservan para consulta histórica y quedan fuera de nuevas ventas. Los componentes externos de un `Combo` nunca se convierten automáticamente en una composición interna.
- El archivo `unidades de medida.xlsx` enlazado en la web de Siigo solo trae 1,089 registros y omite `H87`. Se usa `Unidades de medida SAT.xlsm`, enlazado en el blueprint México: contiene `H87` (Pieza) y 2,418 registros.
- `key` puede llegar como texto; se normaliza a `{ code }`. Las unidades conocidas se conservan en PostgreSQL; las lecturas normales ya no enriquecen filas consultando detalles remotos.
- Listas de precios usan `position` para escribir, no el `id` del catálogo.
- El formulario no expone `model`, `tariff`, `tax_classification` ni `tax_consumption_value`; se conservan desde una lectura vigente y se incluyen solo cuando existen. No se envían cantidades, bodegas, metadatos ni componentes.

## Verificación

Pruebas unitarias y de rutas cubren validación, permisos, filtros, SAT, normalización, preservación de payload, caché y errores ambiguos. Pruebas Nuxt cubren formulario, monedas, errores, calendarios y doble envío. Se verificaron consultas de catálogo y buscadores en Chrome con sesión existente. Las escrituras se prueban con mocks; no se crean datos de prueba en el tenant real.

## Indisponibilidad del servicio de productos (27/10/2026)

Se observó una actualización rechazada con `The Products service is currently unavailable. Please try in a few minutes`, mientras la consulta por ID seguía disponible y conservaba los datos anteriores. La respuesta de una consulta posterior confirmó `status: 503` y código `product_service`. Este mensaje genérico identifica un rechazo del servicio de productos, pero no demuestra por sí solo una caída global. El diagnóstico del 28/10/2026 confirmó que también aparece al intentar desactivar el control de inventario de un producto existente. No repetir automáticamente el PUT ni cerrar el intento como exitoso si los datos no coinciden.

El servidor conserva la causa controlada del fallo (etapa Siigo o persistencia local y código), sin registrar credenciales ni el payload completo. La conciliación compara campos comerciales normalizados con orden estable e informa de los campos diferentes. La interfaz traduce la indisponibilidad, conserva la causa al consultar el resultado y permite revisar el intento recién fallido sin recargar ni perder las correcciones capturadas.

## Imágenes de producto

Siigo México no expone imagen de producto (verificado contra listado y detalle reales el 2026-09-15). La imagen es dato propio de la app:

- Archivo en el bucket público `product-images` de Supabase Storage, ruta `{productId}/{uuid}.{ext}`. Cada subida usa ruta nueva, así la URL pública es inmutable y cacheable; la anterior se borra tras guardar.
- Registro en `public.product_images` (Prisma `ProductImage`), llave = ID de Siigo. El detalle (`GET /api/siigo/products/:id`) la agrega en `internal.image`.
- Solo `PRODUCT_MANAGEMENT_ROLES` sube (`PUT /api/siigo/products/:id/image`, multipart campo `image`) o quita (`DELETE`). El servidor valida la firma del archivo (JPG, PNG, WebP), máximo 2 MB, y que el producto exista en el catálogo de PostgreSQL.
- Storage no tiene políticas para `anon`/`authenticated`: escribe solo el servidor con `NUXT_SUPABASE_SECRET_KEY` (llave `sb_secret_`, nunca `NUXT_PUBLIC_*`) después de `requireRole`.
- Se sube desde la edición del producto; en el detalle solo se muestra si existe. Un producto nuevo recibe imagen después de crearse.

## Guardado confirmado por Siigo (28/10/2026)

Crear, editar y cambiar el estado de un producto sigue este orden:

1. Consultar Siigo y validar los datos y las reglas internas. Reservar únicamente un registro de operación; no actualizar anticipadamente el snapshot del producto.
2. Si Siigo ya refleja exactamente los valores comerciales solicitados, usar esa confirmación sin repetir la escritura. Si no coincide, enviar una sola escritura y consultar el producto por ID sin caché para comprobar todos los campos comerciales, incluido `stock_control`.
3. Solo después de la confirmación guardar el snapshot, los precios, impuestos, composición y disponibilidad interna en una misma transacción local. El producto queda confirmado únicamente si esa transacción termina correctamente.

Si falla la escritura, la comprobación o la transacción local, el intento se marca `failed` y se devuelve `retryable: true`. El producto local conserva sus valores anteriores y el formulario mantiene los cambios capturados, con un error y el botón de guardar habilitado para un reintento manual. Un HTTP exitoso que todavía devuelva los valores anteriores o cambios parciales también falla localmente. No hay reenvíos automáticos ni restauración del formulario en este flujo.

El reintento consulta primero Siigo: si el cambio anterior ya se aplicó, completa solo el guardado local. Para un alta fallida se localiza el producto por su ID conocido o por código exacto antes de considerar otro POST; si existe con datos distintos, se exige abrirlo para editarlo. Las escrituras siguen teniendo un único envío por acción explícita, incluidos los timeouts.

Se conserva el bloqueo únicamente mientras otra operación está en curso o cuando la base de datos no puede cerrar la reserva. Los registros históricos `pending`/`unknown` conservan la recuperación existente; las operaciones nuevas que fallan y pueden cerrarse no entran en conciliación ni dejan bloqueado el producto.

## Rechazo al modificar el control de inventario histórico (28/10/2026)

El producto `3beb3dfb-dfe7-4f34-bde0-0e55a782f93d` (`2603S-1L-OLD`) tenía `stock_control: true`. La aplicación forzaba `false` en todas las ediciones, incluida la desactivación, y Siigo devolvía `product_service`. La desactivación real autorizada del producto, con el mismo código, nombre, precio, impuestos y clave SAT histórica `01010101`, funcionó conservando `stock_control: true`. Una consulta posterior por ID confirmó `active: false`, y la actualización explícita del detalle sincronizó el estado inactivo en PostgreSQL y Chrome.

El formulario ahora conserva el booleano original y el servidor valida que coincida con una lectura vigente. El constructor también preserva ese valor en las actualizaciones, aunque el navegador intente cambiarlo. Las altas y duplicados siguen usando `false`; la composición y el inventario interno no se modifican por esta corrección. Se conservan código y detalles controlados de los errores externos sin incluir credenciales, y `product_service` ya no se presenta como prueba de indisponibilidad general.

## Sincronización de estado de productos existentes (28/10/2026)

Se confirmó por consulta directa que `IW301-0.5LT` (`a27ffd1b-3cd9-4e33-b727-c5826fa50822`) estaba inactivo en Siigo mientras el snapshot local seguía activo. La operación fallaba en la etapa local: el esquema rechazaba el punto del código, por lo que no llegaba a persistir el estado confirmado. Se aceptan puntos en los códigos, conservando las demás restricciones y el máximo de 30 caracteres.

La ruta de activar/desactivar identifica ahora el intento como `statusOnly` exclusivamente desde el servidor. Compara y confirma únicamente `active`; si Siigo ya tiene el estado solicitado, sincroniza el snapshot sin PUT. El commit local de estado no depende de validar todos los datos comerciales ni reconstruye o modifica la composición. Al desactivar, desmarca las tres disponibilidades internas y aumenta la versión solo si esas disponibilidades cambian. Una edición comercial completa conserva su validación y comparación completas.
