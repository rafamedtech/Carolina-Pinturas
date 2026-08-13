// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineEventHandler, readBody } from 'h3'
import type { VueWrapper } from '@vue/test-utils'
import OrderDetailItems from '~/components/orders/OrderDetailItems.vue'
import type { SalesOrderDetail, SalesOrderItem } from '~/types/orders'

const item: SalesOrderItem = {
  id: 'item-1',
  position: 1,
  productId: 'product-1',
  code: 'P-001',
  name: 'Pintura blanca',
  description: null,
  reference: null,
  unit: { code: 'PZA', name: 'Pieza' },
  quantity: 1,
  unitPrice: 100,
  discountType: 'porcentaje',
  discountValue: 0,
  discountPercentage: 0,
  discountAmount: 0,
  subtotal: 100,
  taxAmount: 8,
  total: 108,
  observations: null,
  priceHistory: []
}

const updatedOrder = {
  id: 'order-1',
  version: 2,
  items: [{ ...item, quantity: 2, subtotal: 200, taxAmount: 16, total: 216 }]
} as SalesOrderDetail

const updatedObservationsOrder = {
  ...updatedOrder,
  items: [{ ...item, observations: 'Entregar en cubeta separada' }]
} as SalesOrderDetail

let receivedBody: unknown

registerEndpoint('/api/orders/order-1/items/item-1/cantidad', {
  method: 'PATCH',
  handler: defineEventHandler(async (event) => {
    receivedBody = await readBody(event)
    return updatedOrder
  })
})

registerEndpoint('/api/orders/order-1/items/item-1/observaciones', {
  method: 'PATCH',
  handler: defineEventHandler(async (event) => {
    receivedBody = await readBody(event)
    return updatedObservationsOrder
  })
})

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  receivedBody = undefined
})

describe('OrderDetailItems', () => {
  it('permite editar la cantidad y emite el pedido recalculado', async () => {
    wrapper = await mountSuspended(OrderDetailItems, {
      props: {
        items: [item],
        currencyCode: 'MXN',
        orderId: 'order-1',
        version: 1,
        editable: true
      }
    })

    const editButton = wrapper.find('button[aria-label="Editar cantidad de Pintura blanca"]')
    if (!editButton.exists()) throw new Error('No se encontró la acción para editar la cantidad.')
    await editButton.trigger('click')

    await vi.waitFor(() => {
      if (!document.body.textContent?.includes('Cantidad nueva')) {
        throw new Error('El modal para editar la cantidad aún no aparece.')
      }
    })

    const quantityInput = document.body.querySelector<HTMLInputElement>('input[role="spinbutton"]')
    if (!quantityInput) throw new Error('No se encontró el campo de cantidad.')
    quantityInput.value = '2'
    quantityInput.dispatchEvent(new Event('input', { bubbles: true }))
    quantityInput.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    await nextTick()

    const saveButton = [...document.body.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === 'Guardar' && !button.disabled)
    if (!(saveButton instanceof HTMLButtonElement)) {
      throw new Error('No se encontró el botón para guardar la cantidad.')
    }
    saveButton.click()

    await vi.waitFor(() => {
      if (!wrapper?.emitted('updated')) throw new Error('Aún no se emite updated.')
    })

    expect(receivedBody).toEqual({ quantity: 2, version: 1 })
    expect(wrapper.emitted('updated')).toEqual([[updatedOrder]])
  })

  it('permite agregar observaciones y emite el pedido actualizado', async () => {
    wrapper = await mountSuspended(OrderDetailItems, {
      props: {
        items: [item],
        currencyCode: 'MXN',
        orderId: 'order-1',
        version: 1,
        editable: true
      }
    })

    const editButton = wrapper.find('button[aria-label="Editar observaciones de Pintura blanca"]')
    if (!editButton.exists()) throw new Error('No se encontró la acción para editar las observaciones.')
    await editButton.trigger('click')

    await vi.waitFor(() => {
      if (!document.body.textContent?.includes('Observaciones nuevas')) {
        throw new Error('El modal para editar las observaciones aún no aparece.')
      }
    })

    const observationsInput = document.body.querySelector<HTMLTextAreaElement>('textarea')
    if (!observationsInput) throw new Error('No se encontró el campo de observaciones.')
    observationsInput.value = 'Entregar en cubeta separada'
    observationsInput.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    const saveButton = [...document.body.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === 'Guardar' && !button.disabled)
    if (!(saveButton instanceof HTMLButtonElement)) {
      throw new Error('No se encontró el botón para guardar las observaciones.')
    }
    saveButton.click()

    await vi.waitFor(() => {
      if (!wrapper?.emitted('updated')) throw new Error('Aún no se emite updated.')
    })

    expect(receivedBody).toEqual({
      observations: 'Entregar en cubeta separada',
      version: 1
    })
    expect(wrapper.emitted('updated')).toEqual([[updatedObservationsOrder]])
  })
})
