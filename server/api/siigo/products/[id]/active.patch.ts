import * as z from 'zod'
import { PRODUCT_MANAGEMENT_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../../utils/auth'
import { getProductDetail } from '../../../../utils/siigo-products'
import { attachProductCompositions } from '../../../../utils/product-compositions'
import { usePrisma } from '../../../../utils/prisma'
import { saveManagedProduct } from '../../../../utils/managed-products'
import { productMutationInput } from '../../../../../app/utils/siigoProductMutation'

export default eventHandler(async (event) => {
  await requireRole(event, PRODUCT_MANAGEMENT_ROLES)
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  const parsed = z.object({ active: z.boolean() }).strict().safeParse(await readBody(event))
  if (!id.success || !parsed.success) throw createError({ statusCode: 400, statusMessage: 'Identificador o estado inválido.' })
  const product = (await attachProductCompositions(usePrisma(), [await getProductDetail(id.data, true)]))[0]!
  return saveManagedProduct({ ...productMutationInput(product), active: parsed.data.active }, id.data)
})
