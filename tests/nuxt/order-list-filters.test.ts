// @vitest-environment nuxt
import { afterEach, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData, useRouter } from '#app'
import { defineComponent, h } from 'vue'
import { getQuery } from 'h3'
import type { VueWrapper } from '@vue/test-utils'
import OrderList from '~/components/orders/OrderList.vue'
import type { SalesOrderListItem } from '~/types/orders'

mockNuxtImport('useAuth', () => () => ({
  user: { value: { id: 'admin', role: 'admin' } },
  disabled: { value: false },
  fetchSession: async () => ({ role: 'admin' })
}))

const requests: ReturnType<typeof getQuery>[] = []
const orders = ['Azul', 'Blanco'].map((name, index): SalesOrderListItem => ({
  id: String(index + 1),
  folio: index + 1,
  number: `PED-${index + 1}`,
  status: { key: 'confirmado', label: 'Confirmado', color: 'primary', sortOrder: 1, isTerminal: false },
  customer: { id: name, name, rfc: null },
  orderDate: '2026-10-01',
  promisedDate: null,
  total: 100,
  itemCount: 1,
  paymentStatus: 'pendiente',
  paymentMethod: null,
  createdAt: '2026-10-01T12:00:00Z',
  updatedAt: '2026-10-01T12:00:00Z'
}))

registerEndpoint('/api/orders/statuses', () => [])
registerEndpoint('/api/orders', (event) => {
  const query = getQuery(event)
  requests.push(query)
  const results = query.search ? orders.filter(order => order.customer.name.toLowerCase() === query.search) : orders
  return {
    results,
    filteredTotal: results.length * 100,
    pagination: { page: Number(query.page), pageSize: 25, totalResults: results.length, totalPages: 1 }
  }
})

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  clearNuxtData()
})

it('usa los mismos pedidos en tabla y tarjetas y restaura los filtros iniciales de la vista al limpiar', async () => {
  let router: ReturnType<typeof useRouter>
  const fixture = defineComponent({
    setup() {
      router = useRouter()
      return () => h(OrderList)
    }
  })
  wrapper = await mountSuspended(fixture, {
    route: '/ventas?view=pendiente_pago&search=AZUL&date_from=2026-10-01&date_to=2026-10-03&hide_quotes=false&page=2&ref=dashboard'
  })

  const assertRows = (expected: string[]) => {
    const table = wrapper!.findAll('tbody tr a').map(link => link.text())
    const cards = wrapper!.findAll('article h3').map(title => title.text())
    expect(cards).toEqual(expected)
    expect(table).toEqual(expected)
  }
  await vi.waitFor(() => assertRows(['PED-1']))
  expect(requests.at(-1)).toMatchObject({
    search: 'azul', page: '2', view: 'pendiente_pago', hide_cancelled: 'true',
    date_from: '2026-10-01', date_to: '2026-10-03'
  })
  expect(requests.at(-1)).not.toHaveProperty('hide_quotes')

  await wrapper.findAll('button').find(button => button.text() === 'Quitar filtros')!.trigger('click')
  await vi.waitFor(() => assertRows(['PED-1', 'PED-2']))
  expect(requests.at(-1)).toMatchObject({
    page: '1', view: 'pendiente_pago', hide_cancelled: 'true', hide_quotes: 'true'
  })
  expect(requests.at(-1)).not.toHaveProperty('date_from')
  expect(router!.currentRoute.value.query).toEqual({ view: 'pendiente_pago', ref: 'dashboard' })
  expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('Pendiente de pago')
  expect(wrapper.text()).not.toContain('Quitar filtros')
})
