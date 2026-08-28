import type { SiigoCustomer } from '~/types/siigo'
import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import { getAllSiigoCustomers } from '../../utils/siigo-customer-catalog'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)

  const catalog = await getAllSiigoCustomers()
  const customer = catalog.results.find((candidate) => {
    const name = candidate.name.filter(Boolean).join(' ').trim().toLocaleUpperCase('es-MX')
    return name === 'MOSTRADOR .' || name === 'MOSTRADOR'
  })

  if (!customer) {
    throw createError({
      statusCode: 422,
      statusMessage: 'No se encontró el cliente MOSTRADOR en Siigo.'
    })
  }

  return customer satisfies SiigoCustomer
})
