import type { SiigoCustomer } from '~/types/siigo'
import { normalizeSiigoCustomer, type SiigoCustomerApiResponse } from './siigo-customers'
import { getLocalCustomer } from './siigo-customer-repository'
import { siigoRequest } from './siigo'

interface CustomerDetailDependencies {
  getLocal: typeof getLocalCustomer
  request: typeof siigoRequest<SiigoCustomerApiResponse>
}

const defaultDependencies: CustomerDetailDependencies = {
  getLocal: getLocalCustomer,
  request: siigoRequest
}

export async function getSiigoCustomerDetail(
  customerId: string,
  dependencies: CustomerDetailDependencies = defaultDependencies
): Promise<SiigoCustomer | null> {
  const localCustomer = await dependencies.getLocal(customerId)
  if (!localCustomer) return null

  // El listado masivo puede devolver metadata.created = 0001-01-01, mientras
  // que GET /v1/customers/{id} sí entrega la fecha real de creación.
  const response = await dependencies.request(
    `/v1/customers/${encodeURIComponent(customerId)}`,
    { method: 'GET' }
  )
  const customer = normalizeSiigoCustomer(response)

  return {
    ...customer,
    internal: localCustomer.internal
  }
}
