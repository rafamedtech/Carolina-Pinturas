import * as z from 'zod'
import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../../utils/auth'
import { updateLocalCustomerInvoiceRequirement } from '../../../../utils/siigo-customer-repository'

const customerIdSchema = z.string().uuid()
const invoiceRequirementSchema = z.strictObject({ requiresInvoice: z.boolean() })

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)
  const id = customerIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = invoiceRequirementSchema.safeParse(await readBody(event))

  if (!id.success) {
    throw createError({ statusCode: 400, statusMessage: 'El identificador del cliente no es válido.' })
  }
  if (!body.success) {
    throw createError({ statusCode: 400, statusMessage: 'Selecciona si el cliente requiere factura.' })
  }

  try {
    return await updateLocalCustomerInvoiceRequirement(id.data, body.data.requiresInvoice)
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: 'El cliente no existe en PostgreSQL.' })
    }
    throw error
  }
})
