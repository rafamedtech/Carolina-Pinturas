import { Prisma, type PrismaClient } from '../../generated/prisma/client'
import type { SiigoProduct } from '~/types/siigo'

/** Saves catalog metadata already fetched by the existing product flow.
 * No remote calls, inventory quantities or tracking settings are changed.
 */
export async function persistProductCatalog(db: PrismaClient, products: SiigoProduct[]) {
  const rows = [...new Map(products.map(product => [product.id, product])).values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(product => ({
      id: product.id, code: product.code, name: product.name, type: product.type ?? null,
      active: product.active ?? null,
      unit_code: typeof product.unit === 'string' ? product.unit : product.unit?.code ?? null,
      unit_name: typeof product.unit === 'object' ? product.unit.name ?? null : null,
      reference: product.reference ?? null, barcode: product.additional_fields?.barcode ?? null,
      raw_payload: product
    }))
  // Keep requests bounded while avoiding one nested Prisma write per product.
  for (let offset = 0; offset < rows.length; offset += 500) {
    const payload = JSON.stringify(rows.slice(offset, offset + 500))
    await db.$executeRaw(Prisma.sql`
      INSERT INTO public.siigo_products (id, code, name, type, active, unit_code, unit_name, reference, barcode, raw_payload, synced_at, updated_at)
      SELECT id, code, name, type, active, unit_code, unit_name, reference, barcode, raw_payload, now(), now()
      FROM jsonb_to_recordset(${payload}::jsonb) AS p(
        id uuid, code varchar(100), name text, type varchar(64), active boolean,
        unit_code varchar(32), unit_name text, reference text, barcode text, raw_payload jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code, name = EXCLUDED.name, type = EXCLUDED.type, active = EXCLUDED.active,
        unit_code = EXCLUDED.unit_code, unit_name = EXCLUDED.unit_name,
        reference = EXCLUDED.reference, barcode = EXCLUDED.barcode,
        raw_payload = EXCLUDED.raw_payload, synced_at = EXCLUDED.synced_at, updated_at = EXCLUDED.updated_at
    `)
  }
}
