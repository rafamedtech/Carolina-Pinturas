import type { SiigoCustomer } from '~/types/siigo'
import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import { usePrisma } from '../../utils/prisma'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)

  const customer = await usePrisma().siigoCustomer.findFirst({
    where: {
      displayName: {
        in: ['MOSTRADOR .', 'MOSTRADOR'],
        mode: 'insensitive'
      }
    },
    select: {
      id: true
    }
  })

  if (!customer) {
    throw createError({
      statusCode: 422,
      statusMessage: 'No se encontró el cliente MOSTRADOR en los datos locales.'
    })
  }

  return {
    id: customer.id,
    name: ['MOSTRADOR']
  } satisfies SiigoCustomer
})
