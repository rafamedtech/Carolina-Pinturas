import { requireUser } from '../../../utils/auth'
import { getOrder } from '../../../utils/orders'
import { ticketPrintSchema } from '../../../utils/order-validation'
import { isAllowedPrinterAddress, sendToNetworkPrinter } from '../../../utils/ticket-printer'
import { buildTicketBytes } from '#shared/utils/ticketEscpos'

// Sends the ESC/POS ticket to a network printer over raw TCP. This only works
// when the Nuxt server runs on the same LAN as the printer (self-hosted); on
// cloud hosting use the print dialog or Bluetooth paths instead.
export default eventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido.' })
  }

  const parsed = ticketPrintSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Revisa la configuración de la impresora.',
      data: parsed.error.flatten()
    })
  }

  const { host, port, charsPerLine } = parsed.data
  if (!isAllowedPrinterAddress(host, port)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'La dirección de la impresora debe ser una IP de red local (puerto 9100-9103).'
    })
  }

  const order = await getOrder(id, user)
  const bytes = buildTicketBytes(order, { charsPerLine })
  await sendToNetworkPrinter(host, port, bytes)

  return { printed: true }
})
