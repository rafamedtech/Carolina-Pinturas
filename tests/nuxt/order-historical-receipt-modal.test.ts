// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import OrderHistoricalReceiptModal from '~/components/orders/payments/OrderHistoricalReceiptModal.vue'

registerEndpoint('/api/orders/order-1/payments/payment-1/siigo-receipt/legacy-context', () => ({
  invoiceName: 'FV-1-10',
  paymentAmount: 500,
  paymentDate: '2026-09-03',
  receipts: []
}))

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  clearNuxtData()
})

describe('OrderHistoricalReceiptModal', () => {
  it('ofrece crear y timbrar cuando no encuentra una recepción compatible', async () => {
    wrapper = await mountSuspended(OrderHistoricalReceiptModal, {
      props: {
        open: false,
        orderId: 'order-1',
        paymentId: 'payment-1',
        canCreateAndStamp: true
      }
    })
    await wrapper.setProps({ open: true })

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Sin pagos compatibles')
      expect(document.body.textContent).toContain('Crear y timbrar en Siigo')
    })

    const action = wrapper.findAllComponents({ name: 'UButton' })
      .find(button => button.props('label') === 'Crear y timbrar en Siigo')
    await action?.trigger('click')
    expect(wrapper.emitted('createAndStamp')).toHaveLength(1)
  })
})
