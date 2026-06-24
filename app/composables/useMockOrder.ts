import { computed, ref } from 'vue'

export interface DraftOrderLine {
  productId: string
  code: string
  name: string
  quantity: number
  unitPrice: number
}

interface AddOrderProductInput {
  id: string
  code: string
  name: string
  quantity: number
  unitPrice: number
}

export function useMockOrder() {
  const lines = ref<DraftOrderLine[]>([])

  const total = computed(() =>
    lines.value.reduce((sum, line) => sum + (line.quantity * line.unitPrice), 0)
  )

  function addProduct(product: AddOrderProductInput) {
    const quantity = Math.max(1, product.quantity)
    const existing = lines.value.find(line => line.productId === product.id)

    if (existing) {
      lines.value = lines.value.map(line =>
        line.productId === product.id
          ? { ...line, quantity: line.quantity + quantity }
          : line
      )
      return
    }

    lines.value = [...lines.value, {
      productId: product.id,
      code: product.code,
      name: product.name,
      quantity,
      unitPrice: product.unitPrice
    }]
  }

  function removeProduct(productId: string) {
    lines.value = lines.value.filter(line => line.productId !== productId)
  }

  return { lines, total, addProduct, removeProduct }
}
