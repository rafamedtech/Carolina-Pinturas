import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../utils/auth'
import { requireOrderInvoice } from '../../../utils/orders'
import { requireOrderInvoiceSchema } from '../../../utils/order-validation'

export default eventHandler(async (event) => {
  const user = await requireRole(event, ORDER_LOGISTICS_ROLES)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido.' })
  }

  const parsed = requireOrderInvoiceSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No fue posible solicitar la factura.',
      data: parsed.error.flatten()
    })
  }

  return requireOrderInvoice(id, parsed.data, user)
})
