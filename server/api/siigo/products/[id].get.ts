import type { SiigoProduct } from '~/types/siigo'
import { requireUser } from '../../../utils/auth'
import { siigoRequest } from '../../../utils/siigo'

export default eventHandler((event) => {
  requireUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del producto.' })
  }

  return siigoRequest<SiigoProduct>(`/v1/products/${encodeURIComponent(id)}`)
})
