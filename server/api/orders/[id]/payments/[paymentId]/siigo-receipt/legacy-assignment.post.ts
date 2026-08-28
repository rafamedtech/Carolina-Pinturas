import type { OrderPayment } from '~/types/siigo-payments'
import { requireRole } from '../../../../../../utils/auth'
import { getOrder } from '../../../../../../utils/orders'
import { orderPaymentView } from '../../../../../../utils/order-payments'
import { usePrisma } from '../../../../../../utils/prisma'
import { siigoRequest } from '../../../../../../utils/siigo'
import { siigoJson } from '../../../../../../utils/siigo-persistence'
import {
  assignHistoricalSiigoReceiptSchema,
  assertHistoricalReceiptMatchesPayment,
  isSiigoInvoiceStamped,
  normalizeHistoricalReceiptDetail,
  normalizeInvoiceDetail
} from '../../../../../../utils/siigo-vouchers'

export default eventHandler(async (event): Promise<OrderPayment> => {
  const user = await requireRole(event, ['admin'])
  const orderId = getRouterParam(event, 'id')
  const paymentId = getRouterParam(event, 'paymentId')
  if (!orderId || !paymentId) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido o del pago.' })
  }

  const parsed = assignHistoricalSiigoReceiptSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Selecciona y confirma una recepción válida.',
      data: parsed.error.flatten()
    })
  }

  const [order, payment] = await Promise.all([
    getOrder(orderId, user),
    usePrisma().salesOrderPayment.findFirst({ where: { id: paymentId, orderId } })
  ])
  if (!payment) throw createError({ statusCode: 404, statusMessage: 'No se encontró el pago.' })
  if (payment.siigoVoucherId || !(
    (payment.provider === 'local' && payment.externalStatus === 'not_applicable')
    || (payment.provider === 'siigo' && ['failed', 'unknown'].includes(payment.externalStatus))
  )) {
    throw createError({ statusCode: 409, statusMessage: 'Este pago ya está vinculado o no puede conciliarse con Siigo.' })
  }
  if (payment.siigoInvoiceId && payment.siigoInvoiceId !== order.siigoReference) {
    throw createError({ statusCode: 409, statusMessage: 'El pago conserva una factura de Siigo distinta a la asignada al pedido.' })
  }
  if (!order.siigoReference) {
    throw createError({ statusCode: 409, statusMessage: 'Asigna primero la factura de Siigo al pedido.' })
  }
  if (!order.customer.rfc) {
    throw createError({ statusCode: 422, statusMessage: 'El cliente necesita RFC para conciliar el pago con Siigo.' })
  }

  const [invoiceResponse, receiptResponse] = await Promise.all([
    siigoRequest<unknown>(`/v1/invoices/${encodeURIComponent(order.siigoReference)}`),
    siigoRequest<unknown>(`/v1/vouchers/${encodeURIComponent(parsed.data.voucherId)}`)
  ])
  const invoice = normalizeInvoiceDetail(invoiceResponse)
  if (!isSiigoInvoiceStamped(invoice.stamp?.status)) {
    throw createError({ statusCode: 409, statusMessage: 'La factura asignada debe estar timbrada en Siigo.' })
  }
  const receipt = normalizeHistoricalReceiptDetail(receiptResponse)
  assertHistoricalReceiptMatchesPayment(receipt, {
    voucherId: parsed.data.voucherId,
    invoice,
    customerId: order.customer.id,
    customerRfc: order.customer.rfc,
    amount: Number(payment.amount.toString()),
    date: payment.paymentDate.toISOString().slice(0, 10)
  })

  try {
    const updated = await usePrisma().salesOrderPayment.updateMany({
      where: {
        id: payment.id,
        orderId,
        siigoVoucherId: null,
        OR: [
          { provider: 'local', externalStatus: 'not_applicable' },
          { provider: 'siigo', externalStatus: { in: ['failed', 'unknown'] } }
        ]
      },
      data: {
        provider: 'siigo',
        externalStatus: 'synced',
        externalError: null,
        siigoVoucherId: receipt.id,
        siigoVoucherName: receipt.name,
        siigoInvoiceId: invoice.id,
        siigoInvoiceName: invoice.name,
        siigoDocumentTypeId: receipt.documentTypeId,
        siigoPaymentTypeId: receipt.paymentTypeId,
        siigoCostCenterId: receipt.costCenterId,
        siigoCfdiCode: receipt.cfdiCode,
        siigoPaymentMethod: receipt.paymentMethod,
        siigoQuote: receipt.quote,
        externalPayload: siigoJson(receipt.raw)
      }
    })
    if (updated.count !== 1) {
      throw createError({ statusCode: 409, statusMessage: 'El pago cambió mientras se conciliaba. Actualiza e intenta de nuevo.' })
    }
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'La recepción ya está asociada a otro pago.' })
    }
    throw error
  }

  return orderPaymentView(await usePrisma().salesOrderPayment.findUniqueOrThrow({ where: { id: payment.id } }))
})
