// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import OrderEditor from '~/components/orders/OrderEditor.vue'
import OrderCustomerFields from '~/components/orders/OrderCustomerFields.vue'
import OrderProductPicker from '~/components/orders/OrderProductPicker.vue'
import NewOrderPage from '~/pages/ventas/nuevo-pedido.vue'
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
registerEndpoint('/api/repartidores', () => [
  { id: 'delivery-driver', nombre: 'Repartidor', esMostrador: false, activo: true },
  { id: 'counter-driver', nombre: 'MOSTRADOR', esMostrador: true, activo: true }
])
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
  it('cambia de domicilio a mostrador conservando las partidas y asignando el destino mostrador', async () => {
    wrapper = await mountSuspended(NewOrderPage, {
      route: '/ventas/nuevo-pedido?tipo=domicilio&returnTo=/ventas&vista=lista'
    })
    const editor = wrapper.findComponent(OrderEditor)
    const fields = wrapper.findComponent(OrderCustomerFields)
    await vi.waitFor(() => expect(fields.props('repartidores')).toHaveLength(2))

    fields.vm.$emit('update:repartidorId', 'delivery-driver')
    fields.vm.$emit('update:observations', 'Conservar esta nota')
    wrapper.findComponent(OrderProductPicker).vm.$emit('add', {
      id: 'paint-product', code: 'PINTURA', name: 'Pintura de prueba', unit: 'Pieza'
    }, 2)
    const customer = { ...regularCustomer, name: ['MOSTRADOR', '.'] }
    fields.vm.$emit('update:customerId', customer.id)
    fields.vm.$emit('counterCustomerSelected', customer)

    await vi.waitFor(() => {
      expect(editor.props('saleType')).toBe('counter')
      expect(fields.props('counterSale')).toBe(true)
      expect(fields.props('repartidorId')).toBe('counter-driver')
    })
    expect(fields.props('customers')).toEqual([customer])
    expect(fields.props('customerId')).toBe(customer.id)
    expect(fields.props('observations')).toBe('Conservar esta nota')
    expect(wrapper.text()).toContain('Venta mostrador')
    expect(wrapper.text()).toContain('Pintura de prueba')
    expect(fields.props('showPaymentSelectors')).toBe(true)
    expect(useRouter().currentRoute.value.query).toMatchObject({
      tipo: 'mostrador', returnTo: '/ventas', vista: 'lista'
    })
  })

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
