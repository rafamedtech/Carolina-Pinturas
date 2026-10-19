# Fechas de recepción de pagos en Siigo México

## Comportamiento de la aplicación

Desde el 19/10/2026, el modal de pagos reemplaza el timbrado y los reintentos por API por **Registrar pago en Siigo Nube**. El usuario guarda una sola vez el enlace de la factura mediante **Vincular factura de Siigo Nube** y confirma que su folio corresponde al pedido. Se conserva el código interno en `sales_order_siigo_invoices.nube_invoice_code`, compartido por los usuarios y pagos de la factura. **Cambiar enlace de factura** permite corregirlo; reasignar una factura distinta elimina el código anterior.

El botón de pago abre `https://siigonube.siigo.mx/#/vouchers/844?invoicecode=<código>`, con cliente y factura preseleccionados. **Abrir factura en Siigo Nube** abre `https://siigonube.siigo.mx/#/invoice/843/<código>`. El usuario debe conservar la fecha real, importe y forma de pago y timbrar en Siigo; el enlace no precarga esos datos. Después vincula la recepción mediante **Asignar pago de Siigo**. Sin código guardado, ambos modales solicitan vincular la factura y no abren un formulario vacío.

Verificado en Chrome el 19/10/2026: el UUID de `/v1/invoices` no sustituye el código numérico de Siigo Nube, tampoco `document.id` (tipo de comprobante). La respuesta real y la [consulta oficial de facturas](https://developers.siigo.com/docs/siigoapimexico/facturas/7-get-invoice/) no proporcionan ese código; por eso se obtiene del enlace copiado por el usuario. Solo se admiten enlaces HTTPS de factura de `siigonube.siigo.mx`, o del registro de pago con `invoicecode`, y se construyen rutas canónicas. El servidor exige rol logístico, acceso al pedido, confirmación y la misma factura aún asignada. Esta operación solo guarda metadatos locales; no llama a escrituras fiscales. Los resultados pendientes o inciertos y las recepciones ya creadas siguen abriendo documentos para revisión y evitar duplicados.

Antes de publicar este cambio debe aplicarse `20261019201851_siigo_invoice_nube_code.sql` en producción.

Al registrar un pago local se captura **la fecha en que se recibió el dinero**. Puede ser histórica y se guarda como fecha calendario, sin convertirla a otro día por zona horaria. El formulario de timbrado confirma ese registro; no pide una fecha de emisión ni permite sustituir la fecha real por hoy.

El servidor obtiene la fecha desde `sales_order_payments.payment_date` y verifica que coincida con la confirmada por el navegador. La solicitud de recepción usa esa misma fecha en `date`. El correo se obtiene de los contactos vigentes del cliente en Siigo. Las condiciones que manejan vencimiento, como Crédito Clientes, se excluyen de los ingresos.

Para una recepción existente, se vuelve a consultar el documento y se verifica cliente, factura, fecha e importe. No se cambia la fecha antes del timbrado. Un documento ya aceptado puede conciliarse mediante lectura aunque sea histórico. Un resultado incierto no se reintenta automáticamente.

## Diagnóstico de rechazos

Los intentos fallidos conservan en `external_payload.failure` la etapa (`create` o `stamp`), el estado HTTP y los campos documentados de los errores (`code`, `message`, `params`, `detail`). Se mantiene el payload de creación y, cuando existe, la respuesta con el identificador de la recepción. El mensaje visible incluye la etapa, el código y el detalle disponible, incluso cuando Siigo usa el mensaje genérico “Your request could not be completed…”. No se copian encabezados ni credenciales del error.

Evidencia de lectura del 19/10/2026: el tenant devolvió recepciones aceptadas con `payment.method: PPD` y `payment.cfdi.code: 01`. No rechazar esa combinación basándose solamente en una interpretación de `invalid_cfdi`; el mensaje genérico sin código no permite atribuirle esa causa.

Verificación autorizada del mismo día para PED-000970 / FV-A-272: la API rechazó PUE con `invalid_items` (“The due doesn't exist”), aunque Siigo Nube devolvió la cuota `FV-A|272|1` y saldo 323. Con PPD, forma 04 y UUID fiscal, la creación respondió HTTP 400 con `documents_service` y el mensaje genérico. Incluir UUID no resuelve ese fallo. No atribuirlo a una cuota inexistente ni afirmar que quedó timbrado.

La [guía oficial de recepción PPD](https://siigonubeportaldeclientes.aspel.com.mx/registrar-una-recepcion-de-pago-con-metodo-en-parcialidades-o-diferido/) y el portal fijan PPD para registrar el complemento de una factura timbrada. La aplicación inicializa PPD para este flujo y lo valida al solicitar timbrado, conservando la forma real (efectivo, transferencia, crédito o débito). El dato local `tarjeta` exige elegir crédito o débito; no se presupone 28. Para un documento ya creado se conservan sus datos y se exige revisión en Siigo si no corresponden al flujo electrónico.

## Límite pendiente del contrato externo

Verificación del 13/10/2026:

- Siigo rechazó la recepción cuya fecha se cambió a `2026-10-02` con `Invalid date: 2026-10-02`.
- La [API publicada de creación de recepciones](https://developers.siigo.com/docs/siigoapimexico/payment-reception/1-create-payment-reception/) sólo expone `date`; su esquema expandido no documenta otro campo para separar la fecha real del pago de la emisión del CFDI.
- Los [códigos de error](https://developers.siigo.com/docs/siigoapimexico/codigos-de-error/) describen una ventana de tres días anteriores y uno posterior para facturas electrónicas. No confirman por separado el contrato de fechas históricas del complemento de pagos.
- [Siigo Nube](https://siigonubeportaldeclientes.aspel.com.mx/registrar-una-recepcion-de-pago-con-metodo-en-parcialidades-o-diferido/) pide Fecha de pago como la fecha en que se recibe el abono.

Mientras se confirma con Siigo cómo enviar ambas fechas correctamente, la aplicación bloquea preventivamente el timbrado por API de pagos anteriores a tres días y muestra una acción para revisar la recepción en Siigo Nube. Esta restricción provisional no limita el registro local de pagos históricos ni implica que el SAT prohíba una fecha de pago anterior. No se debe reemplazar esa fecha por hoy ni asumir que una observación modifica `FechaPago` en el XML.

Para habilitar la automatización de históricos hace falta un contrato confirmado que identifique cada fecha y una prueba controlada que verifique el XML resultante. No añadir campos supuestos a `/v1/vouchers` ni cambiar documentos aceptados para sortear el error.
