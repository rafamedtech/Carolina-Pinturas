import { PRODUCT_MANAGEMENT_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../utils/auth'
import { getProductContext } from '../../../utils/siigo-products'

export default eventHandler(async (event) => {
  await requireRole(event, PRODUCT_MANAGEMENT_ROLES)
  return getProductContext()
})
