import * as z from 'zod'
import { requireRole } from '../utils/auth'
import { replaceInternalOrderCustomers } from '../utils/siigo-customer-repository'

const selectionSchema = z.object({
  customerIds: z.array(z.string().uuid()).max(5000)
})

export default eventHandler(async (event) => {
  await requireRole(event, ['admin'])
  const selection = selectionSchema.safeParse(await readBody(event))

  if (!selection.success) {
    throw createError({ statusCode: 400, statusMessage: 'La selección de clientes no es válida.' })
  }

  const customerIds = await replaceInternalOrderCustomers(selection.data.customerIds)
  return { customerIds }
})
