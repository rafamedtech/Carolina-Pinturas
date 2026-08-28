import type { OrderSiigoInvoice, OrderSiigoInvoiceContext } from '~/types/siigo-invoices'
import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../../utils/auth'
import { getOrder } from '../../../../utils/orders'
import { usePrisma } from '../../../../utils/prisma'
import { getSiigoCustomerDetail } from '../../../../utils/siigo-customer-detail'
import {
  missingInvoiceCustomerFields,
  normalizeInvoiceCostCenters,
  normalizeInvoiceDocumentTypes,
  normalizeInvoicePaymentTypes,
  normalizeSiigoSellers,
  normalizeSiigoWarehouses,
  siigoInvoiceWritesEnabled
} from '../../../../utils/siigo-invoices'
import { siigoRequest } from '../../../../utils/siigo'
import { verifyPersistedSiigoInvoice } from '../../../../utils/siigo-invoice-reconciliation'

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

  const prisma = usePrisma()
  const [order, initialPersisted] = await Promise.all([
    getOrder(id, user),
    prisma.salesOrderSiigoInvoice.findUnique({ where: { orderId: id } })
  ])
  let persisted = initialPersisted

  if (persisted?.status === 'created' && persisted.siigoInvoiceId) {
    const existsInSiigo = await verifyPersistedSiigoInvoice({
      invoice: persisted,
      request: siigoRequest,
      markMissing: async (siigoInvoiceId) => {
        await prisma.$transaction(async (tx) => {
          const reconciled = await tx.salesOrderSiigoInvoice.updateMany({
            where: {
              orderId: id,
              status: 'created',
              siigoInvoiceId
            },
            data: {
              status: 'failed',
              siigoInvoiceId: null,
              siigoInvoiceName: null,
              lastError: 'La factura registrada ya no existe en Siigo. Puedes crear un nuevo borrador.'
            }
          })
          if (reconciled.count !== 1) return

          await tx.salesOrder.updateMany({
            where: { id, siigoReference: siigoInvoiceId },
            data: {
              siigoReference: null,
              registeredInSiigoAt: null,
              updatedByEmail: user.email,
              version: { increment: 1 }
            }
          })
        })
      }
    })

    if (!existsInSiigo) {
      persisted = await prisma.salesOrderSiigoInvoice.findUnique({ where: { orderId: id } })
    }
  }
  const isOrder = order.status.key !== 'borrador'
  const eligible = order.requiresInvoice && isOrder
  let eligibilityMessage: string | null = null
  if (!order.requiresInvoice) {
    eligibilityMessage = 'Este pedido no requiere factura; no se creará ningún documento en Siigo.'
  } else if (!isOrder) {
    eligibilityMessage = 'Convierte la cotización en pedido antes de crear la factura borrador.'
  }
  const base = {
    writeEnabled: siigoInvoiceWritesEnabled(),
    requiresInvoice: order.requiresInvoice,
    eligible,
    eligibilityMessage,
    orderNumber: order.number,
    orderDate: order.orderDate,
    orderTotal: order.total,
    customerName: order.customer.name,
    customerRfc: order.customer.rfc,
    customer: null,
    customerReadyForInvoice: false,
    missingCustomerFields: [],
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

  const customer = await getSiigoCustomerDetail(order.customer.id)
  if (!customer) {
    throw createError({
      statusCode: 409,
      statusMessage: 'El cliente del pedido no está disponible en Siigo para validar la factura.'
    })
  }
  const missingCustomerFields = missingInvoiceCustomerFields(customer)
  const customerBase = {
    ...base,
    customer,
    customerReadyForInvoice: missingCustomerFields.length === 0,
    missingCustomerFields
  }

  if (missingCustomerFields.length) {
    return {
      ...customerBase,
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
    ...customerBase,
    documentTypes: normalizeInvoiceDocumentTypes(documents).filter(item => item.active),
    sellers: normalizeSiigoSellers(users).filter(item => item.active),
    paymentTypes: normalizeInvoicePaymentTypes(paymentTypes).filter(item => item.active),
    costCenters: normalizeInvoiceCostCenters(costCenters).filter(item => item.active !== false),
    warehouses: normalizeSiigoWarehouses(warehouses).filter(item => item.active)
  }
})
