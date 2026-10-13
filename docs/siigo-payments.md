# Fechas de recepción de pagos en Siigo México

## Comportamiento de la aplicación

Al registrar un pago local se captura **la fecha en que se recibió el dinero**. Puede ser histórica y se guarda como fecha calendario, sin convertirla a otro día por zona horaria. El formulario de timbrado confirma ese registro; no pide una fecha de emisión ni permite sustituir la fecha real por hoy.

El servidor obtiene la fecha desde `sales_order_payments.payment_date` y verifica que coincida con la confirmada por el navegador. La solicitud de recepción usa esa misma fecha en `date`. El correo se obtiene de los contactos vigentes del cliente en Siigo. Las condiciones que manejan vencimiento, como Crédito Clientes, se excluyen de los ingresos.

Para una recepción existente, se vuelve a consultar el documento y se verifica cliente, factura, fecha e importe. No se cambia la fecha antes del timbrado. Un documento ya aceptado puede conciliarse mediante lectura aunque sea histórico. Un resultado incierto no se reintenta automáticamente.

## Límite pendiente del contrato externo

Verificación del 13/10/2026:

- Siigo rechazó la recepción cuya fecha se cambió a `2026-10-02` con `Invalid date: 2026-10-02`.
- La [API publicada de creación de recepciones](https://developers.siigo.com/docs/siigoapimexico/payment-reception/1-create-payment-reception/) sólo expone `date`; su esquema expandido no documenta otro campo para separar la fecha real del pago de la emisión del CFDI.
- Los [códigos de error](https://developers.siigo.com/docs/siigoapimexico/codigos-de-error/) describen una ventana de tres días anteriores y uno posterior para facturas electrónicas. No confirman por separado el contrato de fechas históricas del complemento de pagos.
- [Siigo Nube](https://siigonubeportaldeclientes.aspel.com.mx/registrar-una-recepcion-de-pago-con-metodo-en-parcialidades-o-diferido/) pide Fecha de pago como la fecha en que se recibe el abono.

Mientras se confirma con Siigo cómo enviar ambas fechas correctamente, la aplicación bloquea preventivamente el timbrado por API de pagos anteriores a tres días y muestra una acción para revisar la recepción en Siigo Nube. Esta restricción provisional no limita el registro local de pagos históricos ni implica que el SAT prohíba una fecha de pago anterior. No se debe reemplazar esa fecha por hoy ni asumir que una observación modifica `FechaPago` en el XML.

Para habilitar la automatización de históricos hace falta un contrato confirmado que identifique cada fecha y una prueba controlada que verifique el XML resultante. No añadir campos supuestos a `/v1/vouchers` ni cambiar documentos aceptados para sortear el error.
