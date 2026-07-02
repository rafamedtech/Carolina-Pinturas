import type { SiigoCustomer, SiigoProduct } from '~/types/siigo'
import { requireUser } from '../../utils/auth'
import { createOrder } from '../../utils/orders'
import { createOrderSchema } from '../../utils/order-validation'
import { usePrisma } from '../../utils/prisma'
import { siigoRequest } from '../../utils/siigo'

export default eventHandler(async (event) => {
  const user = requireUser(event)
  const parsed = createOrderSchema.safeParse(await readBody(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Revisa los datos del pedido.',
      data: parsed.error.flatten()
    })
  }

  const productIds = [...new Set(parsed.data.lines.map(line => line.productId))]
  const repartidorId = parsed.data.repartidorId
  const [customer, repartidor, ...products] = await Promise.all([
    siigoRequest<SiigoCustomer>(`/v1/customers/${encodeURIComponent(parsed.data.customerId)}`),
    repartidorId
      ? usePrisma().repartidor.findUnique({ where: { id: repartidorId } })
      : Promise.resolve(null),
    ...productIds.map(id =>
      siigoRequest<SiigoProduct>(`/v1/products/${encodeURIComponent(id)}`)
    )
  ])
  const productsById = new Map(products.map(product => [product.id, product]))

  if (repartidorId && !repartidor) {
    throw createError({ statusCode: 422, statusMessage: 'El repartidor seleccionado no está disponible.' })
  }

  return createOrder(parsed.data, user, customer, productsById, repartidor)
})
