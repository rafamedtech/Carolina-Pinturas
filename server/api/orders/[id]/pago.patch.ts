import { requireUser } from '../../../utils/auth'
import { updateOrderPayment } from '../../../utils/orders'
import { updateOrderPaymentSchema } from '../../../utils/order-validation'

export default eventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido.' })
  }

  const parsed = updateOrderPaymentSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Revisa el estado de pago.',
      data: parsed.error.flatten()
    })
  }

  return updateOrderPayment(id, parsed.data, user)
})
