# Guía del contrato Siigo API México

## Índice

1. Fuentes y vigencia
2. Autenticación y encabezados
3. Operaciones documentadas
4. Listados, límites y errores
5. Inconsistencias conocidas
6. Lista de comprobación por cambio

## 1. Fuentes y vigencia

- Blueprint incluido: `siigo-api-mexico.apib`, formato API Blueprint 1A, host declarado `https://api.siigo.mx`, 2.414 líneas y aproximadamente 17.000 palabras.
- Documentación oficial vigente: <https://developers.siigo.com/docs/siigoapimexico/>.
- Autenticación oficial: <https://developers.siigo.com/docs/siigoapimexico/auth/generate-token>.
- Límites oficiales: <https://developers.siigo.com/docs/siigoapimexico/limite-de-solicitudes/>.
- Encabezado de aplicación: <https://developers.siigo.com/docs/siigoapimexico/SiigoAPI-Application-Id/>.

Verificado contra el sitio oficial el 2026-07-17. Volver a verificar cuando una tarea dependa de vigencia contractual.

## 2. Autenticación y encabezados

`POST /auth` recibe `username` y `access_key`. La respuesta documentada incluye `access_token`, `expires_in: 86400`, `token_type: Bearer` y `scope`. Interpretar 86400 como segundos/24 horas; el blueprint lo etiqueta erróneamente como milisegundos.

Enviar en todas las solicitudes:

- `Content-Type: application/json` cuando exista body.
- `SiigoAPI-Application-Id: <identificador>` también al autenticar.
- `Authorization: <access_token>` en recursos protegidos, siguiendo el comportamiento regional ya implementado.

No confundir la descripción “OAuth/JWT” con un flujo estándar de client credentials: Siigo expone su propio `/auth` con usuario y llave.

## 3. Operaciones documentadas

| Área | Método y ruta | Propósito |
| --- | --- | --- |
| Auth | `POST /auth` | Generar token |
| Productos | `POST /v1/products` | Crear |
| Productos | `PUT /v1/products/{id}` | Actualizar; el blueprint omite `{id}` en el título |
| Productos | `GET /v1/products/{id}` | Consultar |
| Productos | `GET /v1/products` | Listar y filtrar |
| Clientes | `POST /v1/customers` | Crear |
| Clientes | `PUT /v1/customers/{id}` | Actualizar |
| Clientes | `GET /v1/customers/{id}` | Consultar |
| Clientes | `GET /v1/customers` | Listar y filtrar |
| Facturas | `POST /v1/invoices` | Crear factura |
| Facturas | `POST /v1/invoices/{id}/stamp` | Timbrar en SAT |
| Facturas | `GET /v1/invoices/{id}/stamp/errors` | Consultar rechazo SAT |
| Facturas | `POST /v1/invoices/{id}/mail` | Enviar por correo |
| Facturas | `PUT /v1/invoices/{id}` | Editar; el blueprint omite `{id}` en el título |
| Facturas | `GET /v1/document-types?type=FV` | Tipos de factura |
| Facturas | `GET /v1/invoices/{id}` | Consultar |
| Facturas | `GET /v1/invoices` | Listar |
| Facturas | `DELETE /v1/invoices/{id}` | Eliminar |
| Pagos | `POST /v1/vouchers` | Crear recepción |
| Pagos | `PUT /v1/vouchers/{id}` | Editar |
| Pagos | `GET /v1/vouchers/{id}` | Consultar |
| Pagos | `GET /v1/vouchers` | Listar |
| Pagos | `GET /v1/document-types?type=RC` | Tipos de recepción |
| Pagos | `DELETE /v1/vouchers/{id}` | Eliminar |
| Pagos | `PUT /v1/vouchers/{id}/stamp` | Timbrar; verificar método vigente |
| Pagos | `PUT /v1/vouchers/{id}/stamp/errors` | Consultar rechazo; verificar método vigente |
| Pagos | `PUT /v1/vouchers/{id}/mail` | Enviar por correo; verificar método vigente |
| Catálogos | `GET /v1/account-groups` | Grupos de inventario |
| Catálogos | `GET /v1/taxes` | Impuestos |
| Catálogos | `GET /v1/document-types?type=FV|RC` | Tipos de comprobante |
| Catálogos | `GET /v1/price-lists` | Listas de precios |
| Catálogos | `GET /v1/warehouses` | Bodegas |
| Catálogos | `GET /v1/users` | Usuarios/vendedores |
| Catálogos | `GET /v1/payment-types?document_type=FV` | Condiciones de pago |
| Catálogos | `GET /v1/cost-centers` | Centros de costo |

Las rutas con `{id}` normalizan títulos del blueprint que muestran `id` literal. Confirmar método y ruta en la documentación oficial antes de implementar operaciones fiscales.

## 4. Listados, límites y errores

Los listados usan `page`, `page_size` y filtros como `created_start`/`created_end`; algunos admiten `ids`, `code`, `active` u otros filtros específicos. No asumir que todos aceptan el mismo conjunto.

La forma común documentada es:

```json
{
  "pagination": {
    "page": 1,
    "page_size": 25,
    "total_results": 1
  },
  "results": []
}
```

Límites oficiales consultados: 150 solicitudes/minuto y 5.000/día, además de topes mensuales de creación de facturas según plan. Tratar `429` con espera/backoff solo para lecturas o solicitudes demostrablemente idempotentes. No usar reintentos automáticos ciegos en creaciones/timbrados.

Error documentado:

```json
{
  "Status": 400,
  "Errors": [{
    "Code": "parameter_required",
    "Message": "The field code is required",
    "Params": ["code"],
    "Detail": "Check the API documentation"
  }]
}
```

Conservar status útil de errores `4xx`; mapear timeout a `504` y fallos externos no controlados a `502` según la utilidad existente. No devolver el token, llave ni request completo cuando pueda contener datos sensibles.

## 5. Inconsistencias conocidas

- El cuadro HTTP del blueprint dice 100 solicitudes/minuto; la introducción y el sitio oficial dicen 150/minuto y 5.000/día.
- Algunos enlaces de recepciones usan `https://api.siigo.com` aunque el host México es `.mx`.
- `invalid_reference` contiene un enlace marcador incompleto.
- `expires_in: 86400` está descrito como milisegundos, incompatible con las 24 horas declaradas.
- Varios títulos contienen `/id` literal o rutas sin `{id}`.
- El texto tabular y los esquemas no siempre coinciden en `name`, `address`, `contacts` y `phones` de clientes.
- La documentación oficial renderizada también puede mostrar ejemplos inconsistentes; preferir la evidencia de regresión del proyecto para formas ya observadas.
- El blueprint no incluye versión de publicación ni changelog. La fecha del archivo local no prueba la fecha del contrato.

## 6. Lista de comprobación por cambio

Antes de finalizar:

- Confirmar región `.mx`, método, ruta y status esperado.
- Confirmar campos requeridos, forma de arrays/objetos, enums y precisión decimal.
- Confirmar IDs mediante catálogos del tenant.
- Confirmar permisos del rol en servidor.
- Confirmar manejo de `401`, `429`, timeout y respuesta inesperada.
- Confirmar que una escritura no pueda ejecutarse desde el navegador ni duplicarse por reintento.
- Añadir prueba de regresión para toda discrepancia descubierta.
- Indicar si la validación fue documental, simulada o contra un tenant seguro.
