import { canViewExpenseCategory } from '~/utils/expense'
import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import { usePrisma } from '../../utils/prisma'

export default eventHandler(async (event) => {
  const user = await requireRole(event, ORDER_LOGISTICS_ROLES)
  const id = getRouterParam(event, 'id')
  const prisma = usePrisma()
  const expense = id ? await prisma.expense.findUnique({ where: { id } }) : null

  if (!expense) {
    throw createError({ statusCode: 404, statusMessage: 'El gasto no existe.' })
  }
  if (!canViewExpenseCategory(user.role, expense.category)) {
    throw createError({ statusCode: 403, statusMessage: 'No tienes permiso para eliminar este gasto.' })
  }

  await prisma.expense.delete({ where: { id: expense.id } })
  setResponseStatus(event, 204)
  return null
})
