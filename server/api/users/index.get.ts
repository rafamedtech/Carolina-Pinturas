import { requireRole } from '../../utils/auth'
import { usePrisma } from '../../utils/prisma'

export default eventHandler(async (event) => {
  await requireRole(event, ['admin'])
  return usePrisma().appUser.findMany({
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
    select: { userId: true, name: true, email: true, role: true, active: true }
  })
})
