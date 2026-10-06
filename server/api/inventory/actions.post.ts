import { inventoryCommand } from '#shared/schemas/inventory'
import { requireRole } from '../../utils/auth'
import { executeInventory, INVENTORY_WRITE_ROLES } from '../../utils/inventory'

export default eventHandler(async (event) => {
  const user = await requireRole(event, INVENTORY_WRITE_ROLES)
  const parsed = inventoryCommand.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Revisa los datos del inventario.', data: parsed.error.flatten() })
  try {
    return await executeInventory(parsed.data, user)
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') throw createError({ statusCode: 409, statusMessage: 'El código o documento ya existe.' })
    throw error
  }
})
