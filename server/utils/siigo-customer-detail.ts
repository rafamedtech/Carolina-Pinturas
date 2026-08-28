import type { SiigoCustomer } from '~/types/siigo'
import { normalizeSiigoCustomer, type SiigoCustomerApiResponse } from './siigo-customers'
import { getLocalCustomerInternal } from './siigo-customer-repository'
import { siigoRequest } from './siigo'

interface CustomerDetailDependencies {
  getInternal: typeof getLocalCustomerInternal
  request: typeof siigoRequest<SiigoCustomerApiResponse>
}

const defaultDependencies: CustomerDetailDependencies = {
  getInternal: getLocalCustomerInternal,
  request: siigoRequest
}

export async function getSiigoCustomerDetail(
  customerId: string,
  dependencies: CustomerDetailDependencies = defaultDependencies
): Promise<SiigoCustomer> {
  const [response, internal] = await Promise.all([
    dependencies.request(
      `/v1/customers/${encodeURIComponent(customerId)}`,
      { method: 'GET' }
    ),
    dependencies.getInternal(customerId)
  ])
  const customer = normalizeSiigoCustomer(response)

  return internal ? { ...customer, internal } : customer
}
