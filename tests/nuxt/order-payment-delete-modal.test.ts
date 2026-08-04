// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineEventHandler } from 'h3'
import type { VueWrapper } from '@vue/test-utils'
import OrderPaymentDeleteModal from '~/components/orders/payments/OrderPaymentDeleteModal.vue'
import type { OrderPayment } from '~/types/siigo-payments'

const payment: OrderPayment = {
  id: 'payment-1',
  requestId: '19ee1240-591d-4b72-87da-ee034838553c',
  provider: 'local',
  externalStatus: 'not_applicable',
  externalError: null,
  paymentMethod: 'efectivo',
  amount: 250,
  currencyCode: 'MXN',
  paymentDate: '2026-08-04',
  reference: null,
  observations: null,
  siigo: null,
  createdBy: { name: 'Administrador', email: 'admin@example.com' },
  createdAt: '2026-08-04T12:00:00.000Z'
}

let deleteRequests = 0

registerEndpoint('/api/orders/order-1/payments/payment-1', {
  method: 'DELETE',
  handler: defineEventHandler(() => {
    deleteRequests += 1
    return { id: payment.id }
  })
})

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  deleteRequests = 0
})

describe('OrderPaymentDeleteModal', () => {
  it('confirma la eliminación y notifica el pago eliminado', async () => {
    wrapper = await mountSuspended(OrderPaymentDeleteModal, {
      props: {
        open: false,
        orderId: 'order-1',
        payment
      }
    })

    await wrapper.setProps({ open: true })
    await vi.waitFor(() => {
      if (!document.body.textContent?.includes('Esta acción es permanente')) {
        throw new Error('El modal de confirmación aún no aparece.')
      }
    })

    const deleteButton = [...document.body.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === 'Eliminar pago')
    if (!(deleteButton instanceof HTMLButtonElement)) {
      throw new Error('No se encontró el botón para eliminar el pago.')
    }
    deleteButton.click()

    await vi.waitFor(() => {
      if (!wrapper?.emitted('deleted')) throw new Error('Aún no se emite deleted.')
    })

    expect(deleteRequests).toBe(1)
    expect(wrapper.emitted('deleted')).toEqual([[payment.id]])
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })
})
