import type { SiigoCustomer } from '~/types/siigo'
import { usePrisma } from './prisma'

const customerInternalSelect = {
  id: true,
  internalCode: true,
  internalNotes: true,
  internalTags: true,
  isCustomer: true,
  isSupplier: true,
  isInternalOrderCustomer: true,
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
  isCustomer: boolean
  isSupplier: boolean
  isInternalOrderCustomer: boolean
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
    roles: {
      customer: row.isCustomer,
      supplier: row.isSupplier
    },
    internal_orders: row.isInternalOrderCustomer,
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
  options: { role?: 'Customer' | 'Supplier' } = {}
) {
  if (!customers.length) return customers

  const rows = await usePrisma().siigoCustomer.findMany({
    where: {
      id: { in: customers.map(customer => customer.id) },
      ...(options.role
        ? { [options.role === 'Customer' ? 'isCustomer' : 'isSupplier']: true }
        : {})
    },
    select: customerInternalSelect
  })
  const internalById = new Map(rows.map(row => [row.id, localCustomerInternal(row)]))

  return customers.flatMap((customer) => {
    const internal = internalById.get(customer.id)
    if (internal) return [{ ...customer, internal }]
    return options.role ? [] : [customer]
  })
}

export async function updateLocalCustomerRoles(
  customerId: string,
  roles: { customer: boolean, supplier: boolean }
) {
  const row = await usePrisma().siigoCustomer.update({
    where: { id: customerId },
    data: {
      isCustomer: roles.customer,
      isSupplier: roles.supplier
    },
    select: customerInternalSelect
  })

  return localCustomerInternal(row)
}

export async function replaceInternalOrderCustomers(customerIds: string[]) {
  const prisma = usePrisma()
  const uniqueIds = [...new Set(customerIds)]
  const eligibleCustomers = await prisma.siigoCustomer.findMany({
    where: {
      id: { in: uniqueIds },
      isCustomer: true,
      OR: [{ active: true }, { active: null }]
    },
    select: { id: true }
  })

  if (eligibleCustomers.length !== uniqueIds.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Uno o más clientes seleccionados no están disponibles.'
    })
  }

  await prisma.$transaction([
    prisma.siigoCustomer.updateMany({
      where: { isInternalOrderCustomer: true },
      data: { isInternalOrderCustomer: false }
    }),
    prisma.siigoCustomer.updateMany({
      where: { id: { in: uniqueIds } },
      data: { isInternalOrderCustomer: true }
    })
  ])

  return uniqueIds
}
