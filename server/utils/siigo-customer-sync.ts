import { createError } from 'h3'
import type { SiigoCustomer } from '~/types/siigo'
import type { CreateCustomerInput } from './customer-validation'
import { invalidateSiigoCatalog } from './siigo-catalog'
import {
  buildSiigoCustomerPayload,
  buildSiigoCustomerUpdatePayload,
  normalizeSiigoCustomer,
  type SiigoCustomerApiResponse,
  type SiigoCustomerCreateRequest,
  type SiigoCustomerUpdateRequest
} from './siigo-customers'
import { upsertSiigoCustomer } from './siigo-persistence'
import { usePrisma } from './prisma'
import { siigoRequest } from './siigo'

interface CustomerSyncDependencies {
  assertInternalCodeAvailable: (code: string | undefined, customerId?: string) => Promise<void>
  request: (
    path: string,
    options: {
      method: 'GET' | 'POST' | 'PUT'
      body?: SiigoCustomerCreateRequest | SiigoCustomerUpdateRequest
    }
  ) => Promise<SiigoCustomerApiResponse>
  persist: (
    customer: SiigoCustomer,
    input: CreateCustomerInput,
    updatedByEmail: string
  ) => Promise<unknown>
  invalidate: () => void
}

function defaultDependencies(): CustomerSyncDependencies {
  return {
    async assertInternalCodeAvailable(code, customerId) {
      if (!code) return

      const existing = await usePrisma().siigoCustomer.findUnique({
        where: { internalCode: code },
        select: { id: true }
      })

      if (existing && existing.id !== customerId) {
        throw createError({
          statusCode: 409,
          statusMessage: 'El código interno ya pertenece a otro cliente.'
        })
      }
    },
    request: (path, options) => siigoRequest<SiigoCustomerApiResponse>(path, options),
    persist: (customer, input, updatedByEmail) => usePrisma().$transaction(tx => (
      upsertSiigoCustomer(tx, customer, {
        internal: input.internal,
        updatedByEmail
      })
    )),
    invalidate: () => invalidateSiigoCatalog('customers')
  }
}

async function synchronizeCustomer(
  input: CreateCustomerInput,
  updatedByEmail: string,
  customerId: string | undefined,
  dependencies: CustomerSyncDependencies
) {
  await dependencies.assertInternalCodeAvailable(input.internal?.code, customerId)

  const path = customerId
    ? `/v1/customers/${encodeURIComponent(customerId)}`
    : '/v1/customers'
  let payload: SiigoCustomerCreateRequest | SiigoCustomerUpdateRequest
    = buildSiigoCustomerPayload(input)

  if (customerId) {
    const currentResponse = await dependencies.request(path, { method: 'GET' })
    const currentCustomer = normalizeSiigoCustomer(currentResponse)

    if (currentCustomer.id !== customerId) {
      throw createError({
        statusCode: 502,
        statusMessage: 'Siigo devolvió un identificador distinto al consultar el cliente actual.'
      })
    }

    payload = buildSiigoCustomerUpdatePayload(input, currentCustomer)
  }

  const response = await dependencies.request(
    path,
    {
      method: customerId ? 'PUT' : 'POST',
      body: payload
    }
  )

  // Siigo ya cambió en este punto, incluso si la normalización o PostgreSQL
  // fallan. El catálogo debe renovarse y la mutación externa no se reintenta.
  dependencies.invalidate()
  const customer = normalizeSiigoCustomer(response)

  if (customerId && customer.id !== customerId) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Siigo devolvió un identificador distinto al cliente actualizado.'
    })
  }

  try {
    await dependencies.persist(customer, input, updatedByEmail)
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Siigo guardó el cliente, pero PostgreSQL no pudo confirmar la sincronización. No repitas la operación; concilia el cliente por su ID de Siigo.',
      data: {
        siigoCustomerId: customer.id,
        synchronization: 'pending'
      }
    })
  }

  return customer
}

export function createSynchronizedSiigoCustomer(
  input: CreateCustomerInput,
  updatedByEmail: string,
  dependencies: CustomerSyncDependencies = defaultDependencies()
) {
  return synchronizeCustomer(input, updatedByEmail, undefined, dependencies)
}

export function updateSynchronizedSiigoCustomer(
  customerId: string,
  input: CreateCustomerInput,
  updatedByEmail: string,
  dependencies: CustomerSyncDependencies = defaultDependencies()
) {
  return synchronizeCustomer(input, updatedByEmail, customerId, dependencies)
}
