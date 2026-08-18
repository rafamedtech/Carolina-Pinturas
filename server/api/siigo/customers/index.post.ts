import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../utils/auth'
import { createCustomerSchema } from '../../../utils/customer-validation'
import { createSynchronizedSiigoCustomer } from '../../../utils/siigo-customer-sync'

export default eventHandler(async (event) => {
  const user = await requireRole(event, ORDER_ENTRY_ROLES)
  const parsed = createCustomerSchema.safeParse(await readBody(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Revisa los datos del cliente.',
      data: parsed.error.flatten()
    })
  }

  return createSynchronizedSiigoCustomer(parsed.data, user.email)
})
