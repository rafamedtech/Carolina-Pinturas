import type { SalesOrderDetail } from '~/types/orders'
import { requireRole } from '../../../../utils/auth'
import { getOrder } from '../../../../utils/orders'
import { usePrisma } from '../../../../utils/prisma'
import { siigoRequest } from '../../../../utils/siigo'
import {
  assignHistoricalSiigoInvoiceSchema,
  assertHistoricalInvoiceMatchesOrder,
  normalizeHistoricalInvoiceDetail
} from '../../../../utils/siigo-invoices'
import { siigoJson } from '../../../../utils/siigo-persistence'

export default eventHandler(async (event): Promise<SalesOrderDetail> => {
  const user = await requireRole(event, ['admin'])
  const orderId = getRouterParam(event, 'id')
  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido.' })
  }

  const parsed = assignHistoricalSiigoInvoiceSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Selecciona y confirma una factura histórica válida.',
      data: parsed.error.flatten()
    })
  }

  const order = await getOrder(orderId, user)
  if (order.status.key === 'borrador') {
    throw createError({ statusCode: 409, statusMessage: 'Convierte la cotización en pedido antes de asignar una factura.' })
  }
  if (order.siigoReference || order.invoiceCreated) {
    throw createError({ statusCode: 409, statusMessage: 'Este pedido ya tiene una factura asociada.' })
  }
  if (!order.customer.rfc) {
    throw createError({ statusCode: 422, statusMessage: 'El cliente del pedido no tiene un RFC fiscal.' })
  }

  const invoice = normalizeHistoricalInvoiceDetail(
    await siigoRequest<unknown>(`/v1/invoices/${encodeURIComponent(parsed.data.invoiceId)}`)
  )
  assertHistoricalInvoiceMatchesOrder(invoice, {
    customerId: order.customer.id,
    customerRfc: order.customer.rfc,
    total: order.total
  })

  try {
    await usePrisma().$transaction(async (tx) => {
      const current = await tx.salesOrder.findUnique({
        where: { id: orderId },
        select: {
          siigoReference: true,
          siigoInvoice: { select: { status: true } }
        }
      })
      if (!current) throw createError({ statusCode: 404, statusMessage: 'No se encontró el pedido.' })
      if (current.siigoReference || (current.siigoInvoice && current.siigoInvoice.status !== 'failed')) {
        throw createError({ statusCode: 409, statusMessage: 'Este pedido ya tiene una factura asociada.' })
      }

      const invoiceData = {
        status: 'created',
        siigoInvoiceId: invoice.id,
        siigoInvoiceName: invoice.name,
        documentTypeId: invoice.documentTypeId,
        sellerId: invoice.sellerId,
        paymentTypeId: invoice.paymentTypeId,
        costCenterId: invoice.costCenterId,
        warehouseId: invoice.warehouseId,
        invoiceNumber: invoice.invoiceNumber,
        useCfdi: invoice.useCfdi,
        paymentMethod: invoice.paymentMethod,
        invoiceDate: new Date(`${invoice.date}T00:00:00.000Z`),
        dueDate: new Date(`${invoice.dueDate}T00:00:00.000Z`),
        total: invoice.total,
        lastError: null,
        rawPayload: siigoJson(invoice.raw),
        createdByName: user.name,
        createdByEmail: user.email,
        createdByRole: user.role,
        requestedAt: new Date()
      }
      if (current.siigoInvoice?.status === 'failed') {
        await tx.salesOrderSiigoInvoice.update({ where: { orderId }, data: invoiceData })
      } else {
        await tx.salesOrderSiigoInvoice.create({ data: { orderId, ...invoiceData } })
      }
      await tx.salesOrder.update({
        where: { id: orderId },
        data: {
          requiresInvoice: true,
          siigoReference: invoice.id,
          registeredInSiigoAt: new Date(),
          updatedByEmail: user.email,
          version: { increment: 1 }
        }
      })
    })
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'La factura ya está asociada a otro pedido.' })
    }
    throw error
  }

  return getOrder(orderId, user)
})
