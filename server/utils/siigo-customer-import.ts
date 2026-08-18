import type { SiigoCustomer, SiigoCustomerSyncResult, SiigoListResponse } from '~/types/siigo'
import { collectSiigoCatalog, SIIGO_FULL_CATALOG_PAGE_SIZE } from './siigo-catalog'
import {
  normalizeSiigoCustomerList,
  type SiigoCustomerApiResponse
} from './siigo-customers'
import { upsertSiigoCustomer } from './siigo-persistence'
import { usePrisma } from './prisma'
import { siigoRequest } from './siigo'

interface CustomerImportDependencies {
  fetchPage: (page: number, pageSize: number) => Promise<SiigoListResponse<SiigoCustomer>>
  persistBatch: (customers: SiigoCustomer[]) => Promise<void>
  now: () => Date
}

const CUSTOMER_IMPORT_BATCH_SIZE = 25
let customerImportRequest: Promise<SiigoCustomerSyncResult> | null = null

function defaultDependencies(): CustomerImportDependencies {
  return {
    async fetchPage(page, pageSize) {
      const response = await siigoRequest<SiigoListResponse<SiigoCustomerApiResponse>>('/v1/customers', {
        query: { page: String(page), page_size: String(pageSize) }
      })
      return normalizeSiigoCustomerList(response)
    },
    async persistBatch(customers) {
      await usePrisma().$transaction(
        tx => Promise.all(customers.map(customer => upsertSiigoCustomer(tx, customer))),
        { maxWait: 10_000, timeout: 30_000 }
      )
    },
    now: () => new Date()
  }
}

async function importAllCustomers(dependencies: CustomerImportDependencies) {
  const catalog = await collectSiigoCatalog(
    dependencies.fetchPage,
    SIIGO_FULL_CATALOG_PAGE_SIZE
  )

  let synchronized = 0
  for (let index = 0; index < catalog.results.length; index += CUSTOMER_IMPORT_BATCH_SIZE) {
    const batch = catalog.results.slice(index, index + CUSTOMER_IMPORT_BATCH_SIZE)
    await dependencies.persistBatch(batch)
    synchronized += batch.length
  }

  return {
    received: catalog.results.length,
    synchronized,
    synchronized_at: dependencies.now().toISOString()
  }
}

export function synchronizeSiigoCustomers(
  dependencies: CustomerImportDependencies = defaultDependencies()
) {
  if (customerImportRequest) return customerImportRequest

  customerImportRequest = importAllCustomers(dependencies)
    .finally(() => {
      customerImportRequest = null
    })

  return customerImportRequest
}
