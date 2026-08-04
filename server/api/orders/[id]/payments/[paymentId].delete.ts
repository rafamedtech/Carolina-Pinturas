import { requireUser } from '../../../../utils/auth'
import { deleteOrderPayment } from '../../../../utils/order-payments'

export default eventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  const paymentId = getRouterParam(event, 'paymentId')

  if (!id || !paymentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Falta el identificador del pedido o del pago.'
    })
  }

  return deleteOrderPayment(id, paymentId, user)
})
