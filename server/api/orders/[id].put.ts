import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import { updateOrderSchema } from '../../utils/order-validation'
import { updateOrder } from '../../utils/orders'
import { usePrisma } from '../../utils/prisma'
import { getSiigoOrderCustomer } from '../../utils/siigo-order-customer'
import { getStoredProducts } from '../../utils/stored-products'

export default eventHandler(async (event) => {
  const user = await requireRole(event, ORDER_ENTRY_ROLES)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido.' })
  }

  const parsed = updateOrderSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Revisa los datos del pedido.',
      data: parsed.error.flatten()
    })
  }

  const productIds = [...new Set(parsed.data.lines.map(line => line.productId))]
  const repartidorId = parsed.data.repartidorId
  const [customer, repartidor, products] = await Promise.all([
    getSiigoOrderCustomer(parsed.data.customerId),
    repartidorId
      ? usePrisma().repartidor.findUnique({ where: { id: repartidorId } })
      : Promise.resolve(null),
    getStoredProducts(usePrisma(), productIds)
  ])
  const productsById = new Map(products.map(product => [product.id, product]))

  if (repartidorId && !repartidor) {
    throw createError({ statusCode: 422, statusMessage: 'El repartidor seleccionado no está disponible.' })
  }

  return updateOrder(id, parsed.data, user, customer, productsById, repartidor)
})
