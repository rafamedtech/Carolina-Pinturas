import type { SiigoInvoiceDetail } from '~/types/siigo'
import { requireUser } from '../../../utils/auth'
import { siigoRequest } from '../../../utils/siigo'

export default eventHandler(async (event) => {
  await requireUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador de la factura.' })
  }

  return siigoRequest<SiigoInvoiceDetail>(`/v1/invoices/${encodeURIComponent(id)}`)
})
