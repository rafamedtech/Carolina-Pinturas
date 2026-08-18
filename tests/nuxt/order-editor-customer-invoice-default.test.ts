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
