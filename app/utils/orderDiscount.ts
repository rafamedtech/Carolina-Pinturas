import { orderDiscount } from '#shared/utils/orderAmounts'
import type { OrderDiscountType } from '~/types/orders'

export const DISCOUNT_TYPE_OPTIONS: { label: string, value: OrderDiscountType }[] = [
  { label: '%', value: 'porcentaje' },
  { label: '$', value: 'monto' }
]

export function discountAmountOf(base: number, type: OrderDiscountType, value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0
  return orderDiscount(base, type, value).toNumber()
}
