import { computed, readonly, ref } from 'vue'

export interface DraftOrderLine {
  productId: string
  code: string
  name: string
  quantity: number
  unitPrice: number
  taxIncluded: boolean
  taxPercentage: number
}

interface AddOrderProductInput {
  id: string
  code: string
  name: string
  quantity: number
  unitPrice: number
  taxIncluded: boolean
  taxPercentage: number
}

function lineTotal(line: DraftOrderLine) {
  const listedTotal = line.quantity * line.unitPrice
  return line.taxIncluded
    ? listedTotal
    : listedTotal * (1 + line.taxPercentage / 100)
}

export function useOrderDraft() {
  const internalLines = ref<DraftOrderLine[]>([])

  const total = computed(() =>
    internalLines.value.reduce((sum, line) => sum + lineTotal(line), 0)
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
      quantity,
      unitPrice: product.unitPrice,
      taxIncluded: product.taxIncluded,
      taxPercentage: product.taxPercentage
    }]
  }

  function removeProduct(productId: string) {
    internalLines.value = internalLines.value.filter(line => line.productId !== productId)
  }

  function reset() {
    internalLines.value = []
  }

  return {
    lines: readonly(internalLines),
    total,
    addProduct,
    removeProduct,
    reset
  }
}
