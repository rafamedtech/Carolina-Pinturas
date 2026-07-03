import type { SiigoCustomer, SiigoProduct } from '~/types/siigo'
import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import { updateQuoteSchema } from '../../utils/order-validation'
import { updateQuote } from '../../utils/orders'
import { siigoRequest } from '../../utils/siigo'

export default eventHandler(async (event) => {
  const user = await requireRole(event, ORDER_ENTRY_ROLES)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador de la cotización.' })
  }

  const parsed = updateQuoteSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Revisa los datos de la cotización.',
      data: parsed.error.flatten()
    })
  }

  const productIds = [...new Set(parsed.data.lines.map(line => line.productId))]
  const [customer, ...products] = await Promise.all([
    siigoRequest<SiigoCustomer>(`/v1/customers/${encodeURIComponent(parsed.data.customerId)}`),
    ...productIds.map(productId =>
      siigoRequest<SiigoProduct>(`/v1/products/${encodeURIComponent(productId)}`)
    )
  ])
  const productsById = new Map(products.map(product => [product.id, product]))

  return updateQuote(id, parsed.data, user, customer, productsById)
})
