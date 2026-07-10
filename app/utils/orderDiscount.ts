import type { OrderDiscountType } from '~/types/orders'

export const DISCOUNT_TYPE_OPTIONS: { label: string, value: OrderDiscountType }[] = [
  { label: '%', value: 'porcentaje' },
  { label: '$', value: 'monto' }
]

export function discountAmountOf(base: number, type: OrderDiscountType, value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0
  return type === 'monto'
    ? Math.min(value, base)
    : base * Math.min(value, 100) / 100
}
