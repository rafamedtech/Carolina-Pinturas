import { createError } from 'h3'
import type { Prisma } from '../../generated/prisma/client'
import type { AppUser } from '~/types/siigo'

export type AuditAction = 'create' | 'update' | 'delete' | 'void' | 'reverse'

export interface AuditInput {
  entityType: string
  entityId: string
  action: AuditAction
  snapshot: unknown
  changes?: unknown
  reason?: string | null
  effectiveDate?: Date | null
  source?: { type: string, id: string } | null
}

function json(value: unknown): Prisma.InputJsonValue {
  // Decimal, Date y BigInt se serializan como texto para conservar la foto exacta.
  // Los payloads crudos de Siigo (`*Payload`) se omiten: ya viven en su tabla y harían crecer la bitácora.
  return JSON.parse(JSON.stringify(value, (key, item) => {
    if (/Payload$/.test(key)) return undefined
    return typeof item === 'bigint' ? item.toString() : item
  })) as Prisma.InputJsonValue
}

const AUDITED_TABLES = {
  expense: 'expenses',
  sales_order_payment: 'sales_order_payments'
} as const

/**
 * Bloquea la fila (SELECT … FOR UPDATE) y la relee dentro de la transacción,
 * para que la foto «antes» sea el estado que realmente se modifica.
 */
export async function lockForAudit<T>(
  tx: Prisma.TransactionClient,
  entityType: keyof typeof AUDITED_TABLES,
  id: string,
  read: () => Promise<T | null>
): Promise<T> {
  // La tabla sale de una lista fija; el id va como parámetro.
  await tx.$queryRawUnsafe(`SELECT 1 FROM public.${AUDITED_TABLES[entityType]} WHERE id = $1::uuid FOR UPDATE`, id)
  const row = await read()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'El registro ya no existe. Recarga la información.' })
  return row
}

/**
 * Registra un cambio en la bitácora dentro de la misma transacción que lo produce.
 * La tabla es de solo inserción (trigger en la migración 20261127220000).
 */
export async function recordAuditEvent(tx: Prisma.TransactionClient, user: Pick<AppUser, 'id' | 'email' | 'role'>, input: AuditInput) {
  await tx.auditEvent.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      reason: input.reason?.trim() || null,
      effectiveDate: input.effectiveDate ?? null,
      sourceType: input.source?.type ?? null,
      sourceId: input.source?.id ?? null,
      snapshot: json(input.snapshot),
      ...(input.changes === undefined ? {} : { changes: json(input.changes) })
    }
  })
}
