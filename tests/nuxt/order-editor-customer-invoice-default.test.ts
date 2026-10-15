// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import OrderEditor from '~/components/orders/OrderEditor.vue'
import OrderCustomerFields from '~/components/orders/OrderCustomerFields.vue'
import type { SiigoCustomer } from '~/types/siigo'

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(() => {
    const user = {
      id: 'admin-1',
      name: 'Administrador',
      email: 'admin@example.com',
      role: 'admin' as const,
      repartidorId: null
    }
    return {
      user: { value: user },
      disabled: { value: false },
      fetchSession: vi.fn(async () => user)
    }
  })
}))

mockNuxtImport('useAuth', () => useAuthMock)

const invoiceCustomer: SiigoCustomer = {
  id: '6b6ceb28-b2eb-4b98-b3dd-26648a933c81',
  name: ['Cliente con factura'],
  active: true,
  internal: {
    code: null,
    notes: null,
    tags: [],
    internal_orders: false,
    requires_invoice: true,
    sync_status: 'synced',
    sync_version: 1,
    synced_at: '2026-08-18T00:00:00.000Z'
  }
}
const regularCustomer: SiigoCustomer = {
  ...invoiceCustomer,
  id: '70f666a5-a877-4db1-8be7-98c8878598a4',
  name: ['Cliente sin factura'],
  internal: { ...invoiceCustomer.internal!, requires_invoice: false }
}

registerEndpoint('/api/siigo/customers', () => ({
  results: [invoiceCustomer, regularCustomer],
  pagination: { page: 1, page_size: 2, total_results: 2 }
}))
registerEndpoint('/api/siigo/products', () => ({
  results: [],
  pagination: { page: 1, page_size: 0, total_results: 0 }
}))
registerEndpoint('/api/orders/statuses', () => [])
registerEndpoint('/api/repartidores', () => [])
registerEndpoint('/api/orders/tags', () => [])

let storedQuoteTotal = 38800.08
registerEndpoint('/api/orders/quote-rounding', () => ({
  id: 'quote-rounding', version: 1, status: { key: 'borrador', name: 'Cotización' },
  customer: { id: regularCustomer.id }, orderDate: '2026-10-15',
  paymentStatus: 'pendiente', requiresInvoice: false, tags: [],
  discountType: 'porcentaje', discountValue: 0, total: storedQuoteTotal,
  items: [{
    productId: 'product', code: 'YA116', name: 'Pintura', unit: { code: 'PZA', name: 'Pieza' },
    quantity: 20, unitPrice: 1940, taxIncluded: true, taxPercentages: [8],
    subtotal: 35926, discountAmount: 0, taxAmount: 2874.08, total: storedQuoteTotal,
    discountType: 'porcentaje', discountValue: 0, priceHistory: []
  }]
}))

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  clearNuxtData()
})

describe('OrderEditor · preferencia de factura del cliente', () => {
  it('actualiza Requiere factura al seleccionar un cliente en un pedido nuevo', async () => {
    wrapper = await mountSuspended(OrderEditor, {
      props: { mode: 'order', saleType: 'delivery' }
    })

    const customerFields = wrapper.findComponent(OrderCustomerFields)
    await vi.waitFor(() => {
      expect(customerFields.props('customers')).toHaveLength(2)
    })

    customerFields.vm.$emit('update:customerId', invoiceCustomer.id)
    await nextTick()
    expect(customerFields.props('requiresInvoice')).toBe(true)

    customerFields.vm.$emit('update:customerId', regularCustomer.id)
    await nextTick()
    expect(customerFields.props('requiresInvoice')).toBe(false)
  })
})

describe('OrderEditor · recálculo de cotizaciones', () => {
  it.each([[38800.08, false], [38800, true]])(
    'habilita guardar únicamente cuando cambia el importe o el contenido (%s)', async (storedTotal, disabled) => {
      storedQuoteTotal = Number(storedTotal)
      wrapper = await mountSuspended(OrderEditor, { props: { orderId: 'quote-rounding' } })
      await vi.waitFor(() => {
        expect(wrapper!.text()).toContain('38,800.00')
        const reviewButton = wrapper!.findAll('button').find(button => button.text().trim() === 'Revisar cambios')
        expect(reviewButton).toBeDefined()
        expect(reviewButton!.element.disabled).toBe(disabled)
      })
    }
  )
})
