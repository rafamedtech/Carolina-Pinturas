---
name: siigo-mexico-integration
description: "Implementar, revisar, depurar y validar la integración de Siigo API México en este proyecto Nuxt: autenticación, productos, clientes, facturas, recepciones de pago, catálogos, payloads, tipos, paginación, límites y errores. Usar ante cualquier cambio en server/api/siigo, server/utils/siigo*, app/types/siigo.ts, pruebas de Siigo, variables NUXT_SIIGO_* o flujos que lean o escriban datos en Siigo México."
---

# Integración con Siigo México

Aplicar el contrato de Siigo México sin romper las decisiones arquitectónicas ni las salvaguardas de Carolina Pinturas. Tratar la documentación y las respuestas reales como contratos potencialmente divergentes.

## Flujo obligatorio

1. Leer [project-contract.md](references/project-contract.md) en toda tarea de Siigo.
2. Clasificar la tarea antes de actuar:
   - **Consulta**: autenticación, catálogos, listados o detalle.
   - **Mutación no fiscal**: crear o actualizar productos/clientes.
   - **Operación fiscal**: crear, editar, timbrar, enviar o eliminar facturas/recepciones.
3. Inspeccionar las rutas, utilidades, tipos y pruebas existentes relacionadas. Reutilizar `siigoRequest`; no crear clientes HTTP paralelos sin una necesidad demostrada.
4. Leer la sección pertinente de [api-guide.md](references/api-guide.md). Consultar el blueprint crudo solo para los campos o endpoints necesarios.
5. Verificar la documentación oficial vigente cuando la tarea dependa de un contrato cambiante, una contradicción del blueprint o cualquier mutación.
6. Implementar la integración únicamente del lado servidor. Validar entradas, normalizar respuestas externas y exigir autorización de aplicación en cada ruta.
7. Añadir pruebas de payload, normalización, errores y autorización proporcionales al cambio.
8. Separar implementar código de ejecutar una llamada real. No efectuar una mutación externa solo porque se implementó el soporte.

## Prioridad de fuentes

Resolver contradicciones en este orden:

1. Comportamiento observado y pruebas de regresión fechadas del proyecto.
2. Documentación oficial vigente de Siigo México.
3. Blueprint incluido en `references/siigo-api-mexico.apib`.
4. Suposiciones o ejemplos genéricos.

No sustituir silenciosamente una forma comprobada por un ejemplo de documentación. Registrar en código o pruebas la diferencia relevante y su fecha. Si dos fuentes actuales siguen en conflicto y una decisión podría modificar datos, detener la ejecución real y pedir evidencia o una prueba en tenant no productivo.

## Reglas de implementación

- Mantener `username`, `access_key` y token fuera del cliente, logs, errores públicos y variables `NUXT_PUBLIC_*`.
- Usar `https://api.siigo.mx` como base predeterminada y `SiigoAPI-Application-Id` en `/auth` y demás solicitudes.
- Enviar en `Authorization` el token en la forma ya implementada. No anteponer `Bearer` sin confirmar que el contrato regional lo exige.
- Respetar la caché y renovación anticipada del token. Invalidar la caché ante `401`; no introducir reintentos de mutaciones sin analizar idempotencia.
- Tratar la respuesta de Siigo como `unknown` en la frontera y validar o normalizar antes de exponerla al frontend o persistirla.
- Pasar filtros mediante `query`, codificar parámetros de ruta y conservar la paginación `{ results, pagination }`.
- Traducir fallos de red, timeout y errores `{ Errors: [...] }` a respuestas controladas sin filtrar secretos.
- Consultar IDs configurables —tipos de comprobante, impuestos, listas, bodegas, usuarios, condiciones y centros— desde catálogos; no fijarlos en código.
- Preservar nombres y copy en español y seguir las convenciones Nuxt/H3 existentes.

## Seguridad de mutaciones

Para productos o clientes:

- Implementar primero validación, construcción determinista del payload, normalización y pruebas unitarias.
- Ejecutar smoke tests únicamente si el usuario lo solicita y confirma que el tenant no es productivo.
- Diseñar limpieza o desactivación antes de crear datos de prueba cuando el recurso no admita borrado.

Para facturas y recepciones de pago:

- Mantener deshabilitada la escritura mientras el contrato no se haya validado en un entorno seguro.
- Exigir confirmación explícita del usuario antes de cualquier llamada real que cree, edite, timbre, envíe o elimine un documento fiscal.
- Verificar previamente catálogos, configuración del comprobante, totales, impuestos, forma/método CFDI, fechas y consecuencias irreversibles.
- No reintentar automáticamente una solicitud fiscal tras timeout o respuesta ambigua: el servidor pudo haberla procesado.

## Uso del blueprint

El blueprint supera 10.000 palabras. Buscar secciones puntuales en vez de cargarlo completo:

```bash
rg -n '^# Group|^## .+\[(GET|POST|PUT|DELETE)' references/siigo-api-mexico.apib
rg -n '^## (Product|Customer|Invoice|Voucher)|^## Pagination' references/siigo-api-mexico.apib
rg -n 'invalid_|parameter_|requests_limit|Manejo de errores' references/siigo-api-mexico.apib
```

Usar [api-guide.md](references/api-guide.md) como índice y advertencia de inconsistencias, no como reemplazo de los esquemas detallados.

## Verificación

- Ejecutar primero las pruebas unitarias específicas del cambio.
- Ejecutar `pnpm lint` y `pnpm typecheck` para cambios de integración.
- Ejecutar `pnpm build` cuando cambien límites servidor/cliente, configuración de runtime o tipos compartidos.
- No usar credenciales reales para una prueba automatizada ordinaria.
- Informar qué se verificó con mocks, qué se verificó contra documentación y qué queda pendiente de un tenant seguro.
