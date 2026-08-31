import * as z from 'zod'
import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../../utils/auth'
import { updateLocalCustomerRoles } from '../../../../utils/siigo-customer-repository'

const customerIdSchema = z.string().uuid()
const rolesSchema = z.object({
  customer: z.boolean(),
  supplier: z.boolean()
}).refine(roles => roles.customer || roles.supplier, {
  message: 'El tercero debe conservar al menos un rol.'
})

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_LOGISTICS_ROLES)
  const id = customerIdSchema.safeParse(getRouterParam(event, 'id'))
  const roles = rolesSchema.safeParse(await readBody(event))

  if (!id.success) {
    throw createError({ statusCode: 400, statusMessage: 'El identificador del tercero no es válido.' })
  }
  if (!roles.success) {
    throw createError({ statusCode: 400, statusMessage: 'Selecciona al menos un rol.' })
  }

  try {
    return await updateLocalCustomerRoles(id.data, roles.data)
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: 'El tercero no existe en PostgreSQL.' })
    }
    throw error
  }
})
