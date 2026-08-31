import type { SiigoCustomer } from '~/types/siigo'
import { usePrisma } from './prisma'

const customerInternalSelect = {
  id: true,
  internalCode: true,
  internalNotes: true,
  internalTags: true,
  requiresInvoice: true,
  syncStatus: true,
  syncVersion: true,
  syncedAt: true
} as const

type LocalCustomerInternalRow = {
  id: string
  internalCode: string | null
  internalNotes: string | null
  internalTags: string[]
  requiresInvoice: boolean
  syncStatus: string
  syncVersion: number
  syncedAt: Date
}

export function localCustomerInternal(
  row: LocalCustomerInternalRow
): NonNullable<SiigoCustomer['internal']> {
  return {
    code: row.internalCode,
    notes: row.internalNotes,
    tags: row.internalTags,
    requires_invoice: row.requiresInvoice,
    sync_status: row.syncStatus,
    sync_version: row.syncVersion,
    synced_at: row.syncedAt.toISOString()
  }
}

export async function getLocalCustomerInternal(customerId: string) {
  const row = await usePrisma().siigoCustomer.findUnique({
    where: { id: customerId },
    select: customerInternalSelect
  })

  return row ? localCustomerInternal(row) : undefined
}

export async function withLocalCustomerInternals(
  customers: SiigoCustomer[],
  options: { type?: 'Customer' | 'Supplier' | 'Other' } = {}
) {
  if (!customers.length) return customers

  const rows = await usePrisma().siigoCustomer.findMany({
    where: {
      id: { in: customers.map(customer => customer.id) },
      ...(options.type
        ? { type: { equals: options.type, mode: 'insensitive' as const } }
        : {})
    },
    select: customerInternalSelect
  })
  const internalById = new Map(rows.map(row => [row.id, localCustomerInternal(row)]))

  return customers.flatMap((customer) => {
    const internal = internalById.get(customer.id)
    if (internal) return [{ ...customer, internal }]
    return options.type ? [] : [customer]
  })
}
