import * as z from 'zod'
import { PRODUCT_MANAGEMENT_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../utils/auth'
import { usePrisma } from '../../../utils/prisma'

export default eventHandler(async (event) => {
  await requireRole(event, PRODUCT_MANAGEMENT_ROLES)
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 400, statusMessage: 'Identificador de producto inválido.' })

  const product = await usePrisma().siigoProduct.findUnique({
    where: { id: id.data },
    select: { unitCost: true, costCurrency: true }
  })
  return {
    value: product?.unitCost?.toString() ?? null,
    currency: product?.costCurrency ?? null
  }
})
