import type { OrderSiigoInvoice, OrderSiigoInvoiceContext } from '~/types/siigo-invoices'
import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../../utils/auth'
import { getOrder } from '../../../../utils/orders'
import { usePrisma } from '../../../../utils/prisma'
import {
  isUsableFiscalRfc,
  normalizeInvoiceCostCenters,
  normalizeInvoiceDocumentTypes,
  normalizeInvoicePaymentTypes,
  normalizeSiigoSellers,
  normalizeSiigoWarehouses
} from '../../../../utils/siigo-invoices'
import { siigoRequest } from '../../../../utils/siigo'
import { siigoFiscalWritesEnabled } from '../../../../utils/siigo-vouchers'

function decimal(value: { toString(): string }) {
  return Number(value.toString())
}

function invoiceView(invoice: {
  status: string
  siigoInvoiceId: string | null
  siigoInvoiceName: string | null
  total: { toString(): string }
  invoiceDate: Date
  lastError: string | null
  createdByName: string
  createdByEmail: string
  requestedAt: Date
}): OrderSiigoInvoice {
  return {
    status: invoice.status === 'created'
      ? 'created'
      : invoice.status === 'failed'
        ? 'failed'
        : invoice.status === 'uncertain'
          ? 'uncertain'
          : 'pending',
    siigoInvoiceId: invoice.siigoInvoiceId,
    siigoInvoiceName: invoice.siigoInvoiceName,
    total: decimal(invoice.total),
    invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
    lastError: invoice.lastError,
    createdBy: {
      name: invoice.createdByName,
      email: invoice.createdByEmail
    },
    requestedAt: invoice.requestedAt.toISOString()
  }
}

export default eventHandler(async (event): Promise<OrderSiigoInvoiceContext> => {
  const user = await requireRole(event, ORDER_LOGISTICS_ROLES)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido.' })
  }

  const [order, persisted] = await Promise.all([
    getOrder(id, user),
    usePrisma().salesOrderSiigoInvoice.findUnique({ where: { orderId: id } })
  ])
  const isOrder = order.status.key !== 'borrador'
  const hasFiscalRfc = isUsableFiscalRfc(order.customer.rfc)
  const eligible = order.requiresInvoice && isOrder && hasFiscalRfc
  let eligibilityMessage: string | null = null
  if (!order.requiresInvoice) {
    eligibilityMessage = 'Este pedido no requiere factura; no se creará ningún documento en Siigo.'
  } else if (!isOrder) {
    eligibilityMessage = 'Convierte la cotización en pedido antes de crear la factura borrador.'
  } else if (!hasFiscalRfc) {
    eligibilityMessage = 'El cliente necesita un RFC fiscal válido; el RFC genérico no se usa para este flujo.'
  }
  const base = {
    writeEnabled: siigoFiscalWritesEnabled(),
    requiresInvoice: order.requiresInvoice,
    eligible,
    eligibilityMessage,
    orderNumber: order.number,
    orderDate: order.orderDate,
    orderTotal: order.total,
    customerName: order.customer.name,
    customerRfc: order.customer.rfc,
    invoice: persisted ? invoiceView(persisted) : null
  }

  if (!eligible || (persisted && persisted.status !== 'failed')) {
    return {
      ...base,
      documentTypes: [],
      sellers: [],
      paymentTypes: [],
      costCenters: [],
      warehouses: []
    }
  }

  const [documents, users, paymentTypes, costCenters, warehouses] = await Promise.all([
    siigoRequest<unknown>('/v1/document-types', { query: { type: 'FV' } }),
    siigoRequest<unknown>('/v1/users'),
    siigoRequest<unknown>('/v1/payment-types', { query: { document_type: 'FV' } }),
    siigoRequest<unknown>('/v1/cost-centers'),
    siigoRequest<unknown>('/v1/warehouses')
  ])

  return {
    ...base,
    documentTypes: normalizeInvoiceDocumentTypes(documents).filter(item => item.active),
    sellers: normalizeSiigoSellers(users).filter(item => item.active),
    paymentTypes: normalizeInvoicePaymentTypes(paymentTypes).filter(item => item.active),
    costCenters: normalizeInvoiceCostCenters(costCenters).filter(item => item.active !== false),
    warehouses: normalizeSiigoWarehouses(warehouses).filter(item => item.active)
  }
})
