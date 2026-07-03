import type { SiigoInvoiceDetail } from '~/types/siigo'
import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../utils/auth'
import { siigoRequest } from '../../../utils/siigo'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_LOGISTICS_ROLES)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador de la factura.' })
  }

  return siigoRequest<SiigoInvoiceDetail>(`/v1/invoices/${encodeURIComponent(id)}`)
})
