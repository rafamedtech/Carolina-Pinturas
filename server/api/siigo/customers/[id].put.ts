import * as z from 'zod'
import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../utils/auth'
import { createCustomerSchema } from '../../../utils/customer-validation'
import { getLocalCustomer } from '../../../utils/siigo-customer-repository'
import { updateSynchronizedSiigoCustomer } from '../../../utils/siigo-customer-sync'

const customerIdSchema = z.string().uuid()

export default eventHandler(async (event) => {
  const user = await requireRole(event, ORDER_ENTRY_ROLES)
  const id = customerIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = createCustomerSchema.safeParse(await readBody(event))

  if (!id.success) {
    throw createError({ statusCode: 400, statusMessage: 'El identificador del cliente no es válido.' })
  }

  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Revisa los datos del cliente.',
      data: body.error.flatten()
    })
  }

  await updateSynchronizedSiigoCustomer(id.data, body.data, user.email)

  const customer = await getLocalCustomer(id.data)
  if (!customer) {
    throw createError({
      statusCode: 500,
      statusMessage: 'El cliente se actualizó, pero PostgreSQL no pudo devolver el registro sincronizado.'
    })
  }

  return customer
})
