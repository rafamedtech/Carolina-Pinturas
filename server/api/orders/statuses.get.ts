import { requireUser } from '../../utils/auth'
import { usePrisma } from '../../utils/prisma'

export default eventHandler(async (event) => {
  requireUser(event)

  const statuses = await usePrisma().orderStatus.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' }
  })

  return statuses.map(status => ({
    key: status.key,
    label: status.label,
    color: status.color,
    sortOrder: status.sortOrder,
    isTerminal: status.isTerminal
  }))
})
