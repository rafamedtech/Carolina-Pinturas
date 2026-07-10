import { computed, readonly, ref } from 'vue'
import type { OrderDiscountType } from '~/types/orders'
import { discountAmountOf } from '~/utils/orderDiscount'

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
}

// Refleja el cálculo del servidor (server/utils/orders.ts): el descuento se
// aplica sobre la base sin impuestos y el impuesto sobre la base descontada.
export function draftLineTotal(line: DraftOrderLine) {
  const listedTotal = line.quantity * line.unitPrice
  const base = line.taxIncluded && line.taxPercentage > 0
    ? listedTotal / (1 + line.taxPercentage / 100)
    : listedTotal
  const discounted = base - discountAmountOf(base, line.discountType, line.discountValue)
  return discounted * (1 + line.taxPercentage / 100)
}

export function useOrderDraft() {
  const internalLines = ref<DraftOrderLine[]>([])

  const total = computed(() =>
    internalLines.value.reduce((sum, line) => sum + draftLineTotal(line), 0)
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
