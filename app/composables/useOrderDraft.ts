import { computed, readonly, ref } from 'vue'
import type { OrderDiscountType } from '~/types/orders'
import { orderLineAmounts, orderMoney } from '#shared/utils/orderAmounts'

export interface DraftOrderLine {
  productId: string
  code: string
  name: string
  unit: {
    code: string | null
    name: string | null
  }
  quantity: number
  unitPrice: number
  // Precio de lista de Siigo al agregar la partida; si unitPrice difiere, el
  // guardado envía el precio editado y el servidor registra el cambio.
  catalogPrice: number
  priceNote: string
  taxIncluded: boolean
  taxPercentage: number
  taxPercentages?: readonly number[]
  discountType: OrderDiscountType
  discountValue: number
  observations: string
}

interface AddOrderProductInput {
  id: string
  code: string
  name: string
  unit: {
    code: string | null
    name: string | null
  }
  quantity: number
  unitPrice: number
  taxIncluded: boolean
  taxPercentage: number
  taxPercentages?: readonly number[]
}

export function draftLineTotal(line: DraftOrderLine) {
  return orderLineAmounts(
    line.quantity, line.unitPrice, line.taxPercentages ?? line.taxPercentage,
    line.taxIncluded, line.discountType, line.discountValue
  ).total.toNumber()
}

export function useOrderDraft() {
  const internalLines = ref<DraftOrderLine[]>([])

  const total = computed(() =>
    internalLines.value.reduce((sum, line) => sum.plus(draftLineTotal(line)), orderMoney(0)).toNumber()
  )

  function addProduct(product: AddOrderProductInput) {
    const quantity = Math.max(0.000001, product.quantity)
    const existing = internalLines.value.find(line => line.productId === product.id)

    if (existing) {
      internalLines.value = internalLines.value.map(line =>
        line.productId === product.id
          ? { ...line, quantity: line.quantity + quantity }
          : line
      )
      return
    }

    internalLines.value = [...internalLines.value, {
      productId: product.id,
      code: product.code,
      name: product.name,
      unit: product.unit,
      quantity,
      unitPrice: product.unitPrice,
      catalogPrice: product.unitPrice,
      priceNote: '',
      taxIncluded: product.taxIncluded,
      taxPercentage: product.taxPercentage,
      taxPercentages: product.taxPercentages,
      discountType: 'porcentaje',
      discountValue: 0,
      observations: ''
    }]
  }

  function removeProduct(productId: string) {
    internalLines.value = internalLines.value.filter(line => line.productId !== productId)
  }

  function setObservations(productId: string, observations: string) {
    internalLines.value = internalLines.value.map(line =>
      line.productId === productId ? { ...line, observations } : line
    )
  }

  function setQuantity(productId: string, quantity: number) {
    const normalizedQuantity = Number.isFinite(quantity)
      ? Math.max(0.000001, quantity)
      : 0.000001

    internalLines.value = internalLines.value.map(line =>
      line.productId === productId ? { ...line, quantity: normalizedQuantity } : line
    )
  }

  function setPrice(productId: string, unitPrice: number, priceNote: string) {
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return

    internalLines.value = internalLines.value.map(line =>
      line.productId === productId ? { ...line, unitPrice, priceNote } : line
    )
  }

  function setDiscount(productId: string, discountType: OrderDiscountType, discountValue: number) {
    const normalizedValue = Number.isFinite(discountValue) ? Math.max(0, discountValue) : 0

    internalLines.value = internalLines.value.map(line =>
      line.productId === productId
        ? { ...line, discountType, discountValue: normalizedValue }
        : line
    )
  }

  function reset() {
    internalLines.value = []
  }

  function replaceLines(lines: readonly DraftOrderLine[]) {
    internalLines.value = lines.map(line => ({ ...line }))
  }

  return {
    lines: readonly(internalLines),
    total,
    addProduct,
    removeProduct,
    setObservations,
    setQuantity,
    setPrice,
    setDiscount,
    replaceLines,
    reset
  }
}
