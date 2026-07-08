import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import { usePrisma } from '../../utils/prisma'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)

  const rows = await usePrisma().$queryRaw<{ tag: string }[]>`
    select distinct unnest(tags) as tag
    from public.sales_orders
    order by tag
  `

  return rows.map(row => row.tag)
})
