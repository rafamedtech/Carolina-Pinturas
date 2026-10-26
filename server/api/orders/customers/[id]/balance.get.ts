import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../../utils/auth'
import { usePrisma } from '../../../../utils/prisma'
import { customerBalanceSummary } from '../../../../utils/customer-balance'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)
  const customerId = getRouterParam(event, 'id') || ''
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(customerId)) {
    throw createError({ statusCode: 400, statusMessage: 'El cliente no es válido.' })
  }

  const orders = await usePrisma().salesOrder.findMany({
    where: { customerId, statusKey: { notIn: ['borrador', 'cancelado'] } },
    select: { statusKey: true, orderDate: true, total: true, payments: { select: { amount: true } } }
  })
  return customerBalanceSummary(customerId, orders.map(order => ({
    ...order,
    total: Number(order.total),
    payments: order.payments.map(payment => ({ amount: Number(payment.amount) }))
  })))
})
