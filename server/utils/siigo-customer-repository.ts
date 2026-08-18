import type { Prisma } from '../../generated/prisma/client'
import type { SiigoCustomer, SiigoListResponse } from '~/types/siigo'
import { normalizeSiigoCustomer, type SiigoCustomerApiResponse } from './siigo-customers'
import { usePrisma } from './prisma'

const customerSelect = {
  id: true,
  displayName: true,
  rawPayload: true,
  internalCode: true,
  internalNotes: true,
  internalTags: true,
  requiresInvoice: true,
  syncStatus: true,
  syncVersion: true,
  siigoCreatedAt: true,
  siigoUpdatedAt: true,
  syncedAt: true
} satisfies Prisma.SiigoCustomerSelect

type LocalCustomerRow = Prisma.SiigoCustomerGetPayload<{ select: typeof customerSelect }>

export function localCustomerView(row: LocalCustomerRow): SiigoCustomer {
  const raw = row.rawPayload && typeof row.rawPayload === 'object' && !Array.isArray(row.rawPayload)
    ? row.rawPayload as SiigoCustomerApiResponse
    : {}
  const customer = normalizeSiigoCustomer({
    ...raw,
    id: row.id,
    name: raw.name || [row.displayName]
  })

  return {
    ...customer,
    metadata: {
      created: customer.metadata?.created || row.siigoCreatedAt?.toISOString(),
      last_updated: customer.metadata?.last_updated || row.siigoUpdatedAt?.toISOString() || null
    },
    internal: {
      code: row.internalCode,
      notes: row.internalNotes,
      tags: row.internalTags,
      requires_invoice: row.requiresInvoice,
      sync_status: row.syncStatus,
      sync_version: row.syncVersion,
      synced_at: row.syncedAt.toISOString()
    }
  }
}

export async function listLocalCustomers(options: {
  all?: boolean
  page?: number
  pageSize?: number
} = {}): Promise<SiigoListResponse<SiigoCustomer>> {
  const page = Math.max(1, options.page || 1)
  const pageSize = options.all ? 5000 : Math.min(100, Math.max(1, options.pageSize || 25))
  const prisma = usePrisma()
  const [total, rows] = await prisma.$transaction([
    prisma.siigoCustomer.count(),
    prisma.siigoCustomer.findMany({
      select: customerSelect,
      orderBy: [{ active: 'desc' }, { displayName: 'asc' }],
      skip: options.all ? 0 : (page - 1) * pageSize,
      take: pageSize
    })
  ])

  return {
    results: rows.map(localCustomerView),
    pagination: {
      page: options.all ? 1 : page,
      page_size: rows.length,
      total_results: total
    }
  }
}

export async function getLocalCustomer(customerId: string) {
  const row = await usePrisma().siigoCustomer.findUnique({
    where: { id: customerId },
    select: customerSelect
  })

  return row ? localCustomerView(row) : null
}
