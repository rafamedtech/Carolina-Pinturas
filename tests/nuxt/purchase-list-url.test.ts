// @vitest-environment nuxt
import { afterEach, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData, useRouter } from '#app'
import { defineComponent, h } from 'vue'
import { getQuery } from 'h3'
import type { VueWrapper } from '@vue/test-utils'
import PurchaseList from '~/components/purchases/PurchaseList.vue'

mockNuxtImport('useAuth', () => () => ({
  canWrite: false,
  user: { value: { role: 'admin' } },
  disabled: { value: false },
  fetchSession: async () => ({ role: 'admin' })
}))

const requests: unknown[] = []
registerEndpoint('/api/purchases', (event) => {
  requests.push(getQuery(event))
  return {
    results: Array.from({ length: 26 }, (_, index) => ({
      id: String(index + 1),
      folio: index + 1,
      providerName: 'Pinturas Azul',
      date: '2026-10-01',
      status: 'confirmada',
      currencyCode: 'MXN',
      total: index,
      balance: index,
      invoices: []
    }))
  }
})

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  clearNuxtData()
})

it('opens a shared purchase URL and clears filters without dropping sort or unrelated query keys', async () => {
  const url = '/compras?search=Azul&status=confirmada&date_from=2026-10-01&date_to=2026-10-05&sort=total:desc&page=2&ref=dashboard'
  let router: ReturnType<typeof useRouter> | undefined
  const fixture = defineComponent({
    setup() {
      router = useRouter()
      return () => h(PurchaseList)
    }
  })
  wrapper = await mountSuspended(fixture, {
    route: url,
    global: { stubs: { ListRecordCard: true } }
  })
  await vi.waitFor(() => expect(requests[0]).toEqual({
    search: 'Azul', status: 'confirmada', dateFrom: '2026-10-01', dateTo: '2026-10-05'
  }))
  await vi.waitFor(() => expect(wrapper?.get('table tbody a').text()).toBe('OC-1'))
  const detail = wrapper.get('table tbody a').attributes('href')
  expect(new URL(detail ?? '', 'http://localhost').searchParams.get('returnTo')).toBe(url)

  await wrapper.findAll('button').find(button => button.text() === 'Quitar filtros')!.trigger('click')
  await vi.waitFor(() => expect(router?.currentRoute.value.query).toEqual({ sort: 'total:desc', ref: 'dashboard' }))
  await vi.waitFor(() => expect(wrapper?.get('table tbody a').text()).toBe('OC-26'))
  expect(requests.at(-1)).toEqual({})
})
