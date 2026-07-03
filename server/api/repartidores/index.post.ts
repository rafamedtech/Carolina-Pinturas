import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import { createRepartidor } from '../../utils/repartidores'
import { createRepartidorSchema } from '../../utils/repartidor-validation'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_LOGISTICS_ROLES)
  const parsed = createRepartidorSchema.safeParse(await readBody(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Revisa los datos del repartidor.',
      data: parsed.error.flatten()
    })
  }

  return createRepartidor(parsed.data)
})
