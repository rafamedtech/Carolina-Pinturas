// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from '#app'
import type { VueWrapper } from '@vue/test-utils'
import InventoryDashboard from '~/components/inventory/InventoryDashboard.vue'

mockNuxtImport('useAuth', () => () => ({ user: { value: { role: 'admin' } }, fetchSession: async () => ({ role: 'admin' }) }))
let stockReads = 0
registerEndpoint('/api/inventory/summary', () => ({ trackedProducts: 1 }))
registerEndpoint('/api/inventory/settings', () => ({ enabledAt: null }))
registerEndpoint('/api/inventory/warehouses', () => ({ results: [], pagination: { totalPages: 0 } }))
registerEndpoint('/api/inventory/stocks', () => {
  stockReads++
  return { results: [{ productId: 'p1', name: 'Pintura blanca' }], pagination: { page: 1, totalResults: 1, totalPages: 1 } }
})
const stubs = {
  ListLayout: {
    props: ['config', 'tab', 'loading', 'data'],
    emits: ['update:tab'],
    template: `<section>
      <button @click="$emit('update:tab', 'summary')">Resumen</button>
      <button @click="$emit('update:tab', 'stocks')">Existencias</button>
      <p v-if="loading" role="status">Cargando</p>
      <p v-else>{{ tab === 'summary' ? 'Resumen cargado' : data.map(row => row.name).join(', ') }}</p>
    </section>`
  }
}
let wrapper: VueWrapper | undefined
beforeEach(() => {
  stockReads = 0
  clearNuxtData()
})
afterEach(() => {
  wrapper?.unmount()
  clearNuxtData()
})

describe('carga de existencias al salir del resumen', () => {
  it('consulta existencias sin cambiar filtros y vuelve a consultarlas al regresar', async () => {
    wrapper = await mountSuspended(InventoryDashboard, { route: '/inventario', global: { stubs } })
    await vi.waitFor(() => expect(wrapper?.text()).toContain('Resumen cargado'))
    expect(stockReads).toBe(0)
    await wrapper.get('button:nth-of-type(2)').trigger('click')
    await vi.waitFor(() => expect(wrapper?.text()).toContain('Pintura blanca'))
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(stockReads).toBe(1)
    await wrapper.get('button:nth-of-type(1)').trigger('click')
    await vi.waitFor(() => expect(wrapper?.text()).toContain('Resumen cargado'))
    await wrapper.get('button:nth-of-type(2)').trigger('click')
    await vi.waitFor(() => expect(stockReads).toBe(2))
    await vi.waitFor(() => expect(wrapper?.text()).toContain('Pintura blanca'))
  })
})
