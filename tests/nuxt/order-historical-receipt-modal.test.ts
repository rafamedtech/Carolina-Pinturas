// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import OrderHistoricalReceiptModal from '~/components/orders/payments/OrderHistoricalReceiptModal.vue'

let receiptGate: Promise<void> | undefined
let releaseReceipts: (() => void) | undefined

registerEndpoint('/api/orders/order-1/payments/payment-1/siigo-receipt/legacy-context', async () => {
  await receiptGate
  return ({
    invoiceName: 'FV-1-10',
    paymentAmount: 500,
    paymentDate: '2026-09-03',
    receipts: []
  })
})

registerEndpoint('/api/orders/order-1/payments/payment-2/siigo-receipt/legacy-context', async () => {
  await receiptGate
  return ({
    invoiceName: 'FV-1-10',
    paymentAmount: 500,
    paymentDate: '2026-09-03',
    receipts: [{
      id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
      name: 'RC-2-22',
      date: '2026-09-03',
      amount: 500,
      quote: 2,
      stampStatus: 'Accepted'
    }]
  })
})

let wrapper: VueWrapper | null = null

afterEach(() => {
  releaseReceipts?.()
  receiptGate = undefined
  releaseReceipts = undefined
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  clearNuxtData()
})

describe('OrderHistoricalReceiptModal', () => {
  it('carga las recepciones cuando se monta abierto y oculta el formulario hasta terminar', async () => {
    receiptGate = new Promise<void>((resolve) => {
      releaseReceipts = resolve
    })
    wrapper = await mountSuspended(OrderHistoricalReceiptModal, {
      props: { open: true, orderId: 'order-1', paymentId: 'payment-2' }
    })
    await vi.waitFor(() => expect(document.body.textContent).toContain('Cargando recepciones'))
    expect(document.body.querySelector('#historical-receipt-form')).toBeNull()
    expect([...document.body.querySelectorAll('button')].some(button => button.textContent?.trim() === 'Asignar pago')).toBe(false)
    expect(document.body.textContent).not.toContain('Registrar pago en Siigo Nube')
    releaseReceipts!()
    await vi.waitFor(() => expect(document.body.textContent).toContain('RC-2-22'))
    expect(document.body.textContent).not.toContain('Cargando recepciones')
  })

  it('oculta los resultados y acciones anteriores mientras vuelve a consultar al reabrir', async () => {
    wrapper = await mountSuspended(OrderHistoricalReceiptModal, {
      props: { open: false, orderId: 'order-1', paymentId: 'payment-1',
        siigoUrl: 'https://siigonube.siigo.mx/#/vouchers/844?invoicecode=87200' }
    })
    await wrapper.setProps({ open: true })
    await vi.waitFor(() => expect(document.body.textContent).toContain('Registrar pago en Siigo Nube'))
    await wrapper.setProps({ open: false })
    receiptGate = new Promise<void>((resolve) => {
      releaseReceipts = resolve
    })
    await wrapper.setProps({ open: true })
    await vi.waitFor(() => expect(document.body.textContent).toContain('Cargando recepciones'))
    expect(document.body.textContent).not.toContain('Sin pagos compatibles')
    expect(document.body.textContent).not.toContain('Registrar pago en Siigo Nube')
    expect(document.body.querySelector('#historical-receipt-form')).toBeNull()
    releaseReceipts!()
    await vi.waitFor(() => expect(document.body.textContent).toContain('Registrar pago en Siigo Nube'))
  })

  it('ofrece abrir Siigo Nube cuando no encuentra una recepción compatible', async () => {
    wrapper = await mountSuspended(OrderHistoricalReceiptModal, {
      props: {
        open: false,
        orderId: 'order-1',
        paymentId: 'payment-1',
        siigoUrl: 'https://siigonube.siigo.mx/#/vouchers/844?invoicecode=87200'
      }
    })
    await wrapper.setProps({ open: true })

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Sin pagos compatibles')
      expect(document.body.textContent).toContain('Registrar pago en Siigo Nube')
    })

    const action = wrapper.findAllComponents({ name: 'UButton' })
      .find(button => button.props('label') === 'Registrar pago en Siigo Nube')
    expect(action?.props('to')).toBe('https://siigonube.siigo.mx/#/vouchers/844?invoicecode=87200')
    expect(action?.props('target')).toBe('_blank')
    expect(wrapper.emitted('createAndStamp')).toBeUndefined()
  })

  it('sin enlace solicita vincular la factura en lugar de abrir un pago vacío', async () => {
    wrapper = await mountSuspended(OrderHistoricalReceiptModal, {
      props: { open: false, orderId: 'order-1', paymentId: 'payment-1' }
    })
    await wrapper.setProps({ open: true })
    await vi.waitFor(() => expect(document.body.textContent).toContain('Vincular factura para registrar pago'))
    const action = wrapper.findAllComponents({ name: 'UButton' })
      .find(button => button.props('label') === 'Vincular factura para registrar pago')!
    expect(action.props('to')).toBeUndefined()
    await action.trigger('click')
    expect(wrapper.emitted('configureLink')).toHaveLength(1)
  })

  it('muestra el pago aplicado a la factura en el selector', async () => {
    wrapper = await mountSuspended(OrderHistoricalReceiptModal, {
      props: {
        open: false,
        orderId: 'order-1',
        paymentId: 'payment-2'
      }
    })
    await wrapper.setProps({ open: true })

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('RC-2-22')
      expect(document.body.textContent).toContain('$500.00')
      expect(document.body.textContent).toContain('Parcialidad 2')
    })
  })
})
