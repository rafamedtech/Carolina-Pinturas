// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { getQuery } from 'h3'
import type { VueWrapper } from '@vue/test-utils'
import CustomerOrdersTable from '~/components/customers/CustomerOrdersTable.vue'

const customerId = '9bf22cf2-ba6b-4030-b9a6-3286ea440b61'
let receivedCustomerId = ''
let wrapper: VueWrapper | null = null

registerEndpoint('/api/orders', (event) => {
  receivedCustomerId = String(getQuery(event).customer_id || '')

  return {
    results: [{
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      folio: 42,
      number: 'PED-000042',
      status: { key: 'confirmado', label: 'Confirmado', color: 'success', sortOrder: 2, isTerminal: false },
      customer: { id: customerId, name: 'Cliente actual', rfc: 'VAGR8902073DA' },
      orderDate: '2026-08-18',
      promisedDate: null,
      total: 1250,
      itemCount: 2,
      paymentStatus: 'pendiente',
      paymentMethod: null,
      createdAt: '2026-08-18T17:00:00.000Z',
      updatedAt: '2026-08-18T17:00:00.000Z'
    }],
    filteredTotal: 1250,
    pagination: { page: 1, pageSize: 25, totalResults: 1, totalPages: 1 }
  }
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  receivedCustomerId = ''
  clearNuxtData()
})

describe('CustomerOrdersTable', () => {
  it('solicita y muestra los pedidos del cliente indicado', async () => {
    wrapper = await mountSuspended(CustomerOrdersTable, {
      props: { customerId }
    })

    await vi.waitFor(() => {
      expect(receivedCustomerId).toBe(customerId)
      expect(wrapper?.text()).toContain('PED-000042')
    })

    expect(wrapper.text()).toContain('Pedidos del cliente')
    expect(wrapper.text()).toContain('1 pedido registrado')
  })
})
