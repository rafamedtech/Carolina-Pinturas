import { Prisma } from '../../../../../generated/prisma/client'
import type { OrderSiigoInvoice } from '~/types/siigo-invoices'
import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../../utils/auth'
import { getOrder } from '../../../../utils/orders'
import { usePrisma } from '../../../../utils/prisma'
import { siigoRequest } from '../../../../utils/siigo'
import type { SiigoCustomerApiResponse } from '../../../../utils/siigo-customers'
import { normalizeSiigoCustomer } from '../../../../utils/siigo-customers'
import {
  assertInvoiceReferences,
  buildSiigoInvoiceDraftPayload,
  createOrderSiigoInvoiceSchema,
  isUsableFiscalRfc,
  missingInvoiceCustomerFields,
  normalizeCreatedInvoice,
  normalizeInvoiceCostCenters,
  normalizeInvoiceDocumentTypes,
  normalizeInvoiceProduct,
  normalizeInvoicePaymentTypes,
  normalizeSiigoSellers,
  normalizeSiigoWarehouses,
  siigoInvoiceWritesEnabled
} from '../../../../utils/siigo-invoices'
import { siigoJson } from '../../../../utils/siigo-persistence'

function publicInvoice(invoice: {
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
    total: Number(invoice.total.toString()),
    invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
    lastError: invoice.lastError,
    createdBy: { name: invoice.createdByName, email: invoice.createdByEmail },
    requestedAt: invoice.requestedAt.toISOString()
  }
}

function publicErrorMessage(error: unknown) {
  const candidate = error as { statusMessage?: string, message?: string }
  return (candidate.statusMessage || candidate.message || 'Siigo no pudo crear la factura borrador.').slice(0, 1000)
}

function ambiguousMutation(error: unknown) {
  const status = (error as { statusCode?: number })?.statusCode
  return !status || status >= 500 || status === 408 || status === 429
}

async function reserveAttempt(options: {
  orderId: string
  user: { name: string, email: string, role: string }
  input: ReturnType<typeof createOrderSiigoInvoiceSchema.parse>
  costCenterId: number | null
  total: number
}) {
  const prisma = usePrisma()
  const data = {
    status: 'pending',
    siigoInvoiceId: null,
    siigoInvoiceName: null,
    documentTypeId: options.input.documentTypeId,
    sellerId: options.input.sellerId,
    paymentTypeId: options.input.paymentTypeId,
    costCenterId: options.costCenterId,
    warehouseId: options.input.warehouseId ?? null,
    invoiceNumber: options.input.invoiceNumber ?? null,
    useCfdi: options.input.useCfdi,
    paymentMethod: options.input.paymentMethod,
    invoiceDate: new Date(`${options.input.date}T00:00:00.000Z`),
    dueDate: new Date(`${options.input.dueDate}T00:00:00.000Z`),
    total: options.total,
    lastError: null,
    rawPayload: Prisma.JsonNull,
    createdByName: options.user.name,
    createdByEmail: options.user.email,
    createdByRole: options.user.role,
    requestedAt: new Date()
  } as const
  const existing = await prisma.salesOrderSiigoInvoice.findUnique({ where: { orderId: options.orderId } })

  if (!existing) {
    try {
      return await prisma.salesOrderSiigoInvoice.create({
        data: { orderId: options.orderId, ...data }
      })
    } catch (error: unknown) {
      if ((error as { code?: string }).code !== 'P2002') throw error
      throw createError({ statusCode: 409, statusMessage: 'Ya existe una solicitud de factura para este pedido.' })
    }
  }
  if (existing.status !== 'failed') {
    throw createError({
      statusCode: 409,
      statusMessage: existing.status === 'uncertain'
        ? 'La creación anterior quedó incierta. Verifica la factura en Siigo antes de intentar otra.'
        : 'Este pedido ya tiene una solicitud de factura en Siigo.'
    })
  }

  const claimed = await prisma.salesOrderSiigoInvoice.updateMany({
    where: { orderId: options.orderId, status: 'failed' },
    data
  })
  if (claimed.count !== 1) {
    throw createError({ statusCode: 409, statusMessage: 'Otra solicitud está procesando la factura de este pedido.' })
  }
  return prisma.salesOrderSiigoInvoice.findUniqueOrThrow({ where: { orderId: options.orderId } })
}

export default eventHandler(async (event): Promise<OrderSiigoInvoice> => {
  const user = await requireRole(event, ORDER_LOGISTICS_ROLES)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido.' })
  }

  const parsed = createOrderSiigoInvoiceSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Revisa los datos de la factura borrador.',
      data: parsed.error.flatten()
    })
  }
  if (!siigoInvoiceWritesEnabled()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'La creación de facturas está deshabilitada hasta validar el contrato fiscal en un tenant seguro.'
    })
  }

  const order = await getOrder(id, user)
  if (order.status.key === 'borrador') {
    throw createError({ statusCode: 409, statusMessage: 'Convierte la cotización en pedido antes de crear la factura.' })
  }
  if (!order.requiresInvoice) {
    throw createError({ statusCode: 422, statusMessage: 'Este pedido está marcado como “No requiere factura”.' })
  }
  if (!isUsableFiscalRfc(order.customer.rfc)) {
    throw createError({ statusCode: 422, statusMessage: 'El cliente necesita un RFC fiscal válido para crear la factura.' })
  }

  // Reconsultar cliente, productos y catálogos justo antes de la mutación fiscal.
  const productIds = [...new Set(order.items.map(item => item.productId))]
  const [customerResponse, documents, users, paymentTypes, costCenters, warehouses, ...freshProducts] = await Promise.all([
    siigoRequest<unknown>(`/v1/customers/${encodeURIComponent(order.customer.id)}`),
    siigoRequest<unknown>('/v1/document-types', { query: { type: 'FV' } }),
    siigoRequest<unknown>('/v1/users'),
    siigoRequest<unknown>('/v1/payment-types', { query: { document_type: 'FV' } }),
    siigoRequest<unknown>('/v1/cost-centers'),
    siigoRequest<unknown>('/v1/warehouses'),
    ...productIds.map(productId =>
      siigoRequest<unknown>(`/v1/products/${encodeURIComponent(productId)}`)
    )
  ])
  const customer = normalizeSiigoCustomer(customerResponse as SiigoCustomerApiResponse)
  const customerRfc = (customer.rfc_id || customer.identification || '').toUpperCase()
  if (!isUsableFiscalRfc(customerRfc) || customer.active === false) {
    throw createError({
      statusCode: 409,
      statusMessage: 'El cliente necesita estar activo y tener un RFC fiscal válido en Siigo antes de facturar.'
    })
  }
  const missingCustomerFields = missingInvoiceCustomerFields(customer)
  if (missingCustomerFields.length) {
    throw createError({
      statusCode: 422,
      statusMessage: `Completa la información del cliente antes de facturar: ${missingCustomerFields.join(', ')}.`
    })
  }
  const normalizedProducts = freshProducts.map(normalizeInvoiceProduct)
  const productsByCode = new Map(normalizedProducts.map(product => [product.code, product]))
  const references = assertInvoiceReferences({
    input: parsed.data,
    documentTypes: normalizeInvoiceDocumentTypes(documents),
    sellers: normalizeSiigoSellers(users),
    paymentTypes: normalizeInvoicePaymentTypes(paymentTypes),
    costCenters: normalizeInvoiceCostCenters(costCenters),
    warehouses: normalizeSiigoWarehouses(warehouses)
  })
  const payload = buildSiigoInvoiceDraftPayload({
    input: parsed.data,
    order,
    customerRfc,
    customerBranchOffice: customer.branch_office,
    products: productsByCode,
    documentType: references.documentType,
    costCenterId: references.costCenterId
  })

  await reserveAttempt({
    orderId: id,
    user,
    input: parsed.data,
    costCenterId: references.costCenterId,
    total: order.total
  })

  try {
    // Operación fiscal sin reintento. stamp=false y mail=false son invariantes.
    const created = normalizeCreatedInvoice(await siigoRequest<unknown>('/v1/invoices', {
      method: 'POST',
      body: payload
    }))
    const persisted = await usePrisma().$transaction(async (tx) => {
      const invoice = await tx.salesOrderSiigoInvoice.update({
        where: { orderId: id },
        data: {
          status: 'created',
          siigoInvoiceId: created.id,
          siigoInvoiceName: created.name,
          total: created.total ?? order.total,
          rawPayload: siigoJson(created.raw),
          lastError: null
        }
      })
      await tx.salesOrder.update({
        where: { id },
        data: {
          siigoReference: created.id,
          registeredInSiigoAt: new Date(),
          updatedByEmail: user.email,
          version: { increment: 1 }
        }
      })
      return invoice
    })
    return publicInvoice(persisted)
  } catch (error: unknown) {
    await usePrisma().salesOrderSiigoInvoice.update({
      where: { orderId: id },
      data: {
        status: ambiguousMutation(error) ? 'uncertain' : 'failed',
        lastError: publicErrorMessage(error)
      }
    })
    throw error
  }
})
