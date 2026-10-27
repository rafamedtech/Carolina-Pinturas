import type { Prisma } from '../../generated/prisma/client'

export function productUnitLabel(product: { unitName: string | null, unitCode: string | null, rawPayload?: Prisma.JsonValue }) {
  const raw = product.rawPayload
  const unit = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw.unit : null
  const object = unit && typeof unit === 'object' && !Array.isArray(unit) ? unit : null
  const values = [product.unitName, object?.name, product.unitCode, typeof unit === 'string' ? unit : object?.code]
  return values.find((value): value is string => typeof value === 'string' && Boolean(value.trim()))?.trim() ?? null
}
