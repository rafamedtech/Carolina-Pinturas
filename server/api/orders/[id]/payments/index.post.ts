import type { AppUser } from '~/types/siigo'
import type { CreateLocalOrderPaymentInput, OrderPayment } from '~/types/siigo-payments'
import type { Prisma } from '../../../../../generated/prisma/client'
import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../../utils/auth'
import { getOrder } from '../../../../utils/orders'
import {
  assertPaymentFitsBalance,
  createOrderPaymentSchema,
  orderPaymentView,
  paymentStatus
} from '../../../../utils/order-payments'
import { usePrisma } from '../../../../utils/prisma'

const PAYMENT_TRANSACTION_OPTIONS = {
  isolationLevel: 'Serializable' as const,
  maxWait: 5_000,
  timeout: 15_000
}

function date(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

async function existingPayment(requestId: string, orderId: string) {
  const payment = await usePrisma().salesOrderPayment.findUnique({ where: { requestId } })
  if (payment && payment.orderId !== orderId) {
    throw createError({ statusCode: 409, statusMessage: 'La clave de idempotencia ya pertenece a otro pedido.' })
  }
  return payment
}

async function updateOrderSummary(
  tx: Prisma.TransactionClient,
  orderId: string,
  orderTotal: number,
  paymentMethod: string,
  paymentDate: Date,
  user: AppUser
) {
  const totals = await tx.salesOrderPayment.aggregate({
    where: { orderId },
    _sum: { amount: true }
  })
  const totalPaid = Number(totals._sum.amount?.toString() || 0)
  await tx.salesOrder.update({
    where: { id: orderId },
    data: {
      paymentStatus: paymentStatus(totalPaid, orderTotal),
      paymentMethod,
      paymentDate,
      updatedByEmail: user.email,
      version: { increment: 1 }
    }
  })
}

async function createLocalPayment(options: {
  orderId: string
  orderTotal: number
  currencyCode: string
  input: CreateLocalOrderPaymentInput
  user: AppUser
}) {
  return usePrisma().$transaction(async (tx) => {
    const duplicate = await tx.salesOrderPayment.findUnique({ where: { requestId: options.input.requestId } })
    if (duplicate) return duplicate

    const totals = await tx.salesOrderPayment.aggregate({
      where: { orderId: options.orderId },
      _sum: { amount: true }
    })
    const paidTotal = Number(totals._sum.amount?.toString() || 0)
    assertPaymentFitsBalance(options.input.amount, paidTotal, options.orderTotal)

    const payment = await tx.salesOrderPayment.create({
      data: {
        requestId: options.input.requestId,
        orderId: options.orderId,
        provider: 'local',
        externalStatus: 'not_applicable',
        paymentMethod: options.input.paymentMethod,
        amount: options.input.amount,
        currencyCode: options.currencyCode,
        paymentDate: date(options.input.date),
        reference: options.input.reference || null,
        observations: options.input.observations || null,
        createdByName: options.user.name,
        createdByEmail: options.user.email,
        createdByRole: options.user.role
      }
    })
    await updateOrderSummary(
      tx,
      options.orderId,
      options.orderTotal,
      options.input.paymentMethod,
      date(options.input.date),
      options.user
    )
    return payment
  }, PAYMENT_TRANSACTION_OPTIONS)
}

export default eventHandler(async (event): Promise<OrderPayment> => {
  const user = await requireRole(event, ORDER_LOGISTICS_ROLES)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido.' })
  }

  const parsed = createOrderPaymentSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Revisa los datos del pago.',
      data: parsed.error.flatten()
    })
  }

  const order = await getOrder(id, user)
  if (order.status.key === 'borrador') {
    throw createError({ statusCode: 409, statusMessage: 'Convierte la cotización en pedido antes de registrar un pago.' })
  }

  const duplicate = await existingPayment(parsed.data.requestId, id)
  if (duplicate) return orderPaymentView(duplicate)

  return orderPaymentView(await createLocalPayment({
    orderId: id,
    orderTotal: order.total,
    currencyCode: order.currencyCode,
    input: parsed.data,
    user
  }))
})
