import type { OrderPaymentContext } from '~/types/siigo-payments'
import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../../utils/auth'
import { getOrder } from '../../../../utils/orders'
import { orderPaymentView } from '../../../../utils/order-payments'
import { usePrisma } from '../../../../utils/prisma'
import { siigoRequest } from '../../../../utils/siigo'
import {
  normalizeCostCenters,
  payableInvoicesForCustomer,
  normalizePaymentTypes,
  normalizeVoucherDocumentTypes,
  siigoFiscalWritesEnabled
} from '../../../../utils/siigo-vouchers'

function externalMessage(error: unknown) {
  const value = error as { statusMessage?: string, message?: string }
  return value.statusMessage || value.message || 'No fue posible consultar Siigo.'
}

async function preferredInvoice(invoiceId: string | null) {
  if (!invoiceId) return null

  try {
    return await siigoRequest<unknown>(`/v1/invoices/${encodeURIComponent(invoiceId)}`)
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) return null
    throw error
  }
}

export default eventHandler(async (event): Promise<OrderPaymentContext> => {
  const user = await requireRole(event, ORDER_LOGISTICS_ROLES)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido.' })
  }

  const [order, persisted] = await Promise.all([
    getOrder(id, user),
    usePrisma().salesOrderPayment.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'desc' }
    })
  ])
  const payments = persisted.map(orderPaymentView)
  const paidTotal = payments.reduce((total, payment) => total + payment.amount, 0)
  const orderBalance = Math.max(0, order.total - paidTotal)
  const baseSiigo: OrderPaymentContext['siigo'] = {
    available: false,
    writeEnabled: siigoFiscalWritesEnabled(),
    unavailableReason: null as string | null,
    invoices: [],
    documentTypes: [],
    paymentTypes: [],
    costCenters: []
  }

  if (!order.requiresInvoice) {
    baseSiigo.unavailableReason = 'Este pedido no requiere factura; el pago se registrará únicamente en PostgreSQL.'
  } else if (!order.customer.rfc) {
    baseSiigo.unavailableReason = 'El cliente necesita RFC para vincular una recepción fiscal en Siigo.'
  } else {
    try {
      const [invoiceResponse, associatedInvoice, documentResponse, paymentResponse, costCenterResponse] = await Promise.all([
        siigoRequest<unknown>('/v1/invoices', {
          query: {
            customer_identification: order.customer.rfc,
            page: '1',
            page_size: '100'
          }
        }),
        preferredInvoice(order.siigoReference),
        siigoRequest<unknown>('/v1/document-types', { query: { type: 'RC' } }),
        siigoRequest<unknown>('/v1/payment-types', { query: { document_type: 'FV' } }),
        siigoRequest<unknown>('/v1/cost-centers')
      ])

      baseSiigo.available = true
      baseSiigo.invoices = payableInvoicesForCustomer(invoiceResponse, {
        customerId: order.customer.id,
        customerRfc: order.customer.rfc,
        preferredInvoiceId: order.siigoReference,
        preferredInvoice: associatedInvoice,
        preferredBalance: order.total
      })
      baseSiigo.documentTypes = normalizeVoucherDocumentTypes(documentResponse).filter(item => item.active)
      baseSiigo.paymentTypes = normalizePaymentTypes(paymentResponse).filter(item => item.active)
      baseSiigo.costCenters = normalizeCostCenters(costCenterResponse).filter(item => item.active !== false)
    } catch (error) {
      baseSiigo.unavailableReason = externalMessage(error)
    }
  }

  return {
    requiresInvoice: order.requiresInvoice,
    orderTotal: order.total,
    paidTotal,
    balance: orderBalance,
    payments,
    siigo: baseSiigo
  }
})
