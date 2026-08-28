import type { HistoricalSiigoInvoiceContext } from '~/types/siigo-invoices'
import type { SiigoListResponse } from '~/types/siigo'
import { requireRole } from '../../../../utils/auth'
import { collectSiigoCatalog } from '../../../../utils/siigo-catalog'
import { normalizeHistoricalInvoiceOptions } from '../../../../utils/siigo-invoices'
import { getOrder } from '../../../../utils/orders'
import { usePrisma } from '../../../../utils/prisma'
import { siigoRequest } from '../../../../utils/siigo'

export default eventHandler(async (event): Promise<HistoricalSiigoInvoiceContext> => {
  const user = await requireRole(event, ['admin'])
  const orderId = getRouterParam(event, 'id')
  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido.' })
  }

  const [order, persisted] = await Promise.all([
    getOrder(orderId, user),
    usePrisma().salesOrderSiigoInvoice.findUnique({ where: { orderId } })
  ])
  if (order.status.key === 'borrador') {
    throw createError({ statusCode: 409, statusMessage: 'Convierte la cotización en pedido antes de asignar una factura.' })
  }
  if (order.siigoReference || (persisted && persisted.status !== 'failed')) {
    throw createError({ statusCode: 409, statusMessage: 'Este pedido ya tiene una factura asociada.' })
  }
  if (!order.customer.rfc) {
    throw createError({ statusCode: 422, statusMessage: 'El cliente del pedido no tiene un RFC fiscal.' })
  }

  const response = await collectSiigoCatalog<unknown>((page, pageSize) =>
    siigoRequest<SiigoListResponse<unknown>>('/v1/invoices', {
      query: {
        customer_identification: order.customer.rfc!,
        page: String(page),
        page_size: String(pageSize)
      }
    })
  )

  return {
    orderNumber: order.number,
    orderTotal: order.total,
    customerName: order.customer.name,
    invoices: normalizeHistoricalInvoiceOptions(response, {
      customerId: order.customer.id,
      customerRfc: order.customer.rfc,
      orderTotal: order.total
    })
  }
})
