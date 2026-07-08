import type { SiigoProduct } from '~/types/siigo'

export function siigoProductUnitParts(product: Pick<SiigoProduct, 'unit'> | null | undefined) {
  const unit = product?.unit
  if (!unit) return { code: null, name: null }
  if (typeof unit === 'string') return { code: null, name: unit }

  return { code: unit.code || null, name: unit.name || null }
}

export function siigoProductUnit(product: Pick<SiigoProduct, 'unit'> | null | undefined) {
  const { name, code } = siigoProductUnitParts(product)
  return name || code
}
