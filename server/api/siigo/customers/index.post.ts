import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../utils/auth'
import { createCustomerSchema } from '../../../utils/customer-validation'
import {
  buildSiigoCustomerPayload,
  normalizeSiigoCustomer,
  type SiigoCustomerApiResponse
} from '../../../utils/siigo-customers'
import { invalidateSiigoCatalog } from '../../../utils/siigo-catalog'
import { siigoRequest } from '../../../utils/siigo'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)
  const parsed = createCustomerSchema.safeParse(await readBody(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Revisa los datos del cliente.',
      data: parsed.error.flatten()
    })
  }

  const response = await siigoRequest<SiigoCustomerApiResponse>('/v1/customers', {
    method: 'POST',
    body: buildSiigoCustomerPayload(parsed.data)
  })

  invalidateSiigoCatalog('customers')
  return normalizeSiigoCustomer(response)
})
