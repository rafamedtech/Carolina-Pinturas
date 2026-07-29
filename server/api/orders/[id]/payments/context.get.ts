import type { OrderPaymentContext } from '~/types/siigo-payments'
import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../../utils/auth'
import { getOrder } from '../../../../utils/orders'
import { orderPaymentView } from '../../../../utils/order-payments'
import { usePrisma } from '../../../../utils/prisma'
import { siigoRequest } from '../../../../utils/siigo'
import {
  normalizeCostCenters,
  normalizePayableInvoices,
  normalizePaymentTypes,
  normalizeVoucherDocumentTypes,
  siigoFiscalWritesEnabled
} from '../../../../utils/siigo-vouchers'

function externalMessage(error: unknown) {
  const value = error as { statusMessage?: string, message?: string }
  return value.statusMessage || value.message || 'No fue posible consultar Siigo.'
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
      const [invoiceResponse, documentResponse, paymentResponse, costCenterResponse] = await Promise.all([
        siigoRequest<unknown>('/v1/invoices', {
          query: {
            customer_identification: order.customer.rfc,
            customer_branch_office: '0',
            page: '1',
            page_size: '100'
          }
        }),
        siigoRequest<unknown>('/v1/document-types', { query: { type: 'RC' } }),
        siigoRequest<unknown>('/v1/payment-types', { query: { document_type: 'FV' } }),
        siigoRequest<unknown>('/v1/cost-centers')
      ])

      baseSiigo.available = true
      baseSiigo.invoices = normalizePayableInvoices(invoiceResponse).filter(invoice =>
        invoice.customerId === order.customer.id || invoice.customerRfc === order.customer.rfc
      )
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
    balance: Math.max(0, order.total - paidTotal),
    payments,
    siigo: baseSiigo
  }
})
