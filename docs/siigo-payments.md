# Fechas de recepción de pagos en Siigo México

## Comportamiento de la aplicación

Desde el 19/10/2026, la única acción de integración disponible en el modal de pagos es **Asignar pago de Siigo**. El pago se registra localmente y un administrador puede vincularlo a una recepción ya registrada en la factura asignada al pedido. La conciliación exige que coincidan factura, cliente, fecha e importe; no crea ni modifica documentos fiscales.

Se retiraron del modal las acciones de timbrado, registro o apertura de Siigo Nube y la captura de enlaces por factura. Si no hay recepciones compatibles, se informa que primero debe registrarse la recepción en Siigo y después volver a consultar. Se mantienen las restricciones para facturas sin timbrar, pagos reservados o ya vinculados y referencias a otra factura.

La columna opcional `nube_invoice_code` y su migración publicada se conservan por compatibilidad con bases existentes; el flujo de pagos ya no la consulta ni requiere enlaces de Siigo.

Al registrar un pago local se captura **la fecha en que se recibió el dinero**. Puede ser histórica y se guarda como fecha calendario, sin convertirla a otro día por zona horaria. La conciliación conserva esa fecha y no permite sustituirla por hoy.

Las rutas de emisión por API conservadas en el servidor, sin acceso desde este modal, obtienen la fecha desde `sales_order_payments.payment_date` y verifican que coincida con la confirmada por el navegador. La solicitud de recepción usa esa misma fecha en `date`. El correo se obtiene de los contactos vigentes del cliente en Siigo. Las condiciones que manejan vencimiento, como Crédito Clientes, se excluyen de los ingresos.

Para una recepción existente, se vuelve a consultar el documento y se verifica cliente, factura, fecha e importe. No se cambia la fecha antes del timbrado. Un documento ya aceptado puede conciliarse mediante lectura aunque sea histórico. Un resultado incierto no se reintenta automáticamente.

## Diagnóstico de rechazos

Los intentos fallidos conservan en `external_payload.failure` la etapa (`create` o `stamp`), el estado HTTP y los campos documentados de los errores (`code`, `message`, `params`, `detail`). Se mantiene el payload de creación y, cuando existe, la respuesta con el identificador de la recepción. El mensaje visible incluye la etapa, el código y el detalle disponible, incluso cuando Siigo usa el mensaje genérico “Your request could not be completed…”. No se copian encabezados ni credenciales del error.

Evidencia de lectura del 19/10/2026: el tenant devolvió recepciones aceptadas con `payment.method: PPD` y `payment.cfdi.code: 01`. No rechazar esa combinación basándose solamente en una interpretación de `invalid_cfdi`; el mensaje genérico sin código no permite atribuirle esa causa.

Verificación autorizada del mismo día para PED-000970 / FV-A-272: la API rechazó PUE con `invalid_items` (“The due doesn't exist”), aunque Siigo Nube devolvió la cuota `FV-A|272|1` y saldo 323. Con PPD, forma 04 y UUID fiscal, la creación respondió HTTP 400 con `documents_service` y el mensaje genérico. Incluir UUID no resuelve ese fallo. No atribuirlo a una cuota inexistente ni afirmar que quedó timbrado.

La [guía oficial de recepción PPD](https://siigonubeportaldeclientes.aspel.com.mx/registrar-una-recepcion-de-pago-con-metodo-en-parcialidades-o-diferido/) y el portal fijan PPD para registrar el complemento de una factura timbrada. Las rutas de emisión por API inicializan PPD para este flujo y lo validan al solicitar timbrado, conservando la forma real (efectivo, transferencia, crédito o débito). El dato local `tarjeta` exige elegir crédito o débito; no se presupone 28. Para un documento ya creado se conservan sus datos y se exige revisión en Siigo si no corresponden al flujo electrónico.

## Límite pendiente del contrato externo

Verificación del 13/10/2026:

- Siigo rechazó la recepción cuya fecha se cambió a `2026-10-02` con `Invalid date: 2026-10-02`.
- La [API publicada de creación de recepciones](https://developers.siigo.com/docs/siigoapimexico/payment-reception/1-create-payment-reception/) sólo expone `date`; su esquema expandido no documenta otro campo para separar la fecha real del pago de la emisión del CFDI.
- Los [códigos de error](https://developers.siigo.com/docs/siigoapimexico/codigos-de-error/) describen una ventana de tres días anteriores y uno posterior para facturas electrónicas. No confirman por separado el contrato de fechas históricas del complemento de pagos.
- [Siigo Nube](https://siigonubeportaldeclientes.aspel.com.mx/registrar-una-recepcion-de-pago-con-metodo-en-parcialidades-o-diferido/) pide Fecha de pago como la fecha en que se recibe el abono.

Mientras se confirma con Siigo cómo enviar ambas fechas correctamente, la aplicación bloquea preventivamente el timbrado por API de pagos anteriores a tres días ; el modal ofrece únicamente asignar recepciones existentes. Esta restricción provisional no limita el registro local de pagos históricos ni implica que el SAT prohíba una fecha de pago anterior. No se debe reemplazar esa fecha por hoy ni asumir que una observación modifica `FechaPago` en el XML.

Para habilitar la automatización de históricos hace falta un contrato confirmado que identifique cada fecha y una prueba controlada que verifique el XML resultante. No añadir campos supuestos a `/v1/vouchers` ni cambiar documentos aceptados para sortear el error.
