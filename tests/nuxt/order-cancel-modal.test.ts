// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineEventHandler, readBody } from 'h3'
import type { VueWrapper } from '@vue/test-utils'
import OrderCancelModal from '~/components/orders/OrderCancelModal.vue'
import type { SalesOrderDetail } from '~/types/orders'

const cancelledOrder = {
  id: 'order-1',
  number: 'PED-0001',
  version: 4,
  status: {
    key: 'cancelado',
    label: 'Cancelado',
    color: 'error',
    sortOrder: 90,
    isTerminal: true
  }
} as SalesOrderDetail

let receivedBody: unknown

registerEndpoint('/api/orders/order-1/status', {
  method: 'PATCH',
  handler: defineEventHandler(async (event) => {
    receivedBody = await readBody(event)
    return cancelledOrder
  })
})

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  receivedBody = undefined
})

describe('OrderCancelModal', () => {
  it('confirma la cancelación y devuelve el pedido actualizado', async () => {
    wrapper = await mountSuspended(OrderCancelModal, {
      props: {
        open: false,
        orderId: 'order-1',
        orderNumber: 'PED-0001',
        version: 3
      }
    })

    await wrapper.setProps({ open: true })
    await vi.waitFor(() => {
      if (!document.body.textContent?.includes('El pedido quedará marcado como cancelado')) {
        throw new Error('El modal de confirmación aún no aparece.')
      }
    })

    const confirmButton = [...document.body.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === 'Cancelar pedido')

    if (!(confirmButton instanceof HTMLButtonElement)) {
      throw new TypeError('No se encontró el botón para cancelar el pedido.')
    }

    confirmButton.click()

    await vi.waitFor(() => {
      if (!wrapper?.emitted('cancelled')) throw new Error('Aún no se emite cancelled.')
    })

    expect(receivedBody).toEqual({
      statusKey: 'cancelado',
      note: 'Pedido cancelado desde el menú de opciones.',
      version: 3
    })
    expect(wrapper.emitted('cancelled')).toEqual([[cancelledOrder]])
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })
})
