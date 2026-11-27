import { canViewExpenseCategory } from '~/utils/expense'
import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import { lockForAudit, recordAuditEvent } from '../../utils/audit'
import { usePrisma } from '../../utils/prisma'

export default eventHandler(async (event) => {
  const user = await requireRole(event, ORDER_LOGISTICS_ROLES)
  const id = getRouterParam(event, 'id')
  const prisma = usePrisma()
  const expense = id ? await prisma.expense.findUnique({ where: { id } }) : null

  if (!expense) {
    throw createError({ statusCode: 404, statusMessage: 'El gasto no existe.' })
  }
  if (expense.purchasePaymentId) {
    throw createError({ statusCode: user.role === 'admin' ? 409 : 404, statusMessage: user.role === 'admin' ? 'Gestiona este gasto desde Compras.' : 'El gasto no existe.' })
  }
  if (!canViewExpenseCategory(user.role, expense.category)) {
    throw createError({ statusCode: 403, statusMessage: 'No tienes permiso para eliminar este gasto.' })
  }

  await prisma.$transaction(async (tx) => {
    const previous = await lockForAudit(tx, 'expense', expense.id, () => tx.expense.findUnique({ where: { id: expense.id } }))
    if (previous.purchasePaymentId) throw createError({ statusCode: 404, statusMessage: 'El gasto no existe.' })
    await recordAuditEvent(tx, user, {
      entityType: 'expense',
      entityId: previous.id,
      action: 'delete',
      snapshot: previous,
      effectiveDate: previous.expenseDate
    })
    await tx.expense.delete({ where: { id: previous.id } })
  })
  setResponseStatus(event, 204)
  return null
})
