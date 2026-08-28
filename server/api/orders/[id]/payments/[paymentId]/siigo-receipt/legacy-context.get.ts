import type { HistoricalSiigoReceiptContext } from '~/types/siigo-payments'
import type { SiigoListResponse } from '~/types/siigo'
import { requireRole } from '../../../../../../utils/auth'
import { getOrder } from '../../../../../../utils/orders'
import { usePrisma } from '../../../../../../utils/prisma'
import { siigoRequest } from '../../../../../../utils/siigo'
import { cachedSiigoCatalog, collectSiigoCatalog } from '../../../../../../utils/siigo-catalog'
import {
  isSiigoInvoiceStamped,
  normalizeHistoricalReceiptOptions,
  normalizeInvoiceDetail
} from '../../../../../../utils/siigo-vouchers'

function paymentCanBeReconciled(payment: { provider: string, externalStatus: string, siigoVoucherId: string | null }) {
  return !payment.siigoVoucherId && (
    (payment.provider === 'local' && payment.externalStatus === 'not_applicable')
    || (payment.provider === 'siigo' && ['failed', 'unknown'].includes(payment.externalStatus))
  )
}

export default eventHandler(async (event): Promise<HistoricalSiigoReceiptContext> => {
  const user = await requireRole(event, ['admin'])
  const orderId = getRouterParam(event, 'id')
  const paymentId = getRouterParam(event, 'paymentId')
  if (!orderId || !paymentId) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido o del pago.' })
  }

  const [order, payment] = await Promise.all([
    getOrder(orderId, user),
    usePrisma().salesOrderPayment.findFirst({ where: { id: paymentId, orderId } })
  ])
  if (!payment) throw createError({ statusCode: 404, statusMessage: 'No se encontró el pago.' })
  if (!paymentCanBeReconciled(payment)) {
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

  const invoice = normalizeInvoiceDetail(
    await siigoRequest<unknown>(`/v1/invoices/${encodeURIComponent(order.siigoReference)}`)
  )
  if (!isSiigoInvoiceStamped(invoice.stamp?.status)) {
    throw createError({ statusCode: 409, statusMessage: 'La factura asignada debe estar timbrada en Siigo.' })
  }

  const date = payment.paymentDate.toISOString().slice(0, 10)
  const [response, assignedReceipts] = await Promise.all([
    cachedSiigoCatalog(`historical-vouchers:${date}`, () =>
      collectSiigoCatalog<unknown>((page, pageSize) =>
        siigoRequest<SiigoListResponse<unknown>>('/v1/vouchers', {
          query: {
            created_start: date,
            page: String(page),
            page_size: String(pageSize)
          }
        })
      )
    ),
    usePrisma().salesOrderPayment.findMany({
      where: { siigoVoucherId: { not: null } },
      select: { siigoVoucherId: true }
    })
  ])
  const assignedIds = new Set(assignedReceipts.flatMap(item => item.siigoVoucherId ? [item.siigoVoucherId] : []))
  const amount = Number(payment.amount.toString())

  return {
    invoiceName: invoice.name || order.siigoReference,
    paymentAmount: amount,
    paymentDate: date,
    receipts: normalizeHistoricalReceiptOptions(response, {
      invoice,
      customerId: order.customer.id,
      customerRfc: order.customer.rfc,
      amount,
      date
    }).filter(receipt => !assignedIds.has(receipt.id))
  }
})
