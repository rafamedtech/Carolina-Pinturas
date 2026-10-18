// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from '#app'
import InventoryOrderStock from '~/components/inventory/InventoryOrderStock.vue'
import type { VueWrapper } from '@vue/test-utils'

mockNuxtImport('useAuth', () => () => ({ user: { value: { role: 'admin' } } }))
let activationRequired = true
let wrapper: VueWrapper | undefined
registerEndpoint('/api/orders/activation-quote/inventory', () => ({ managed: true, activationRequired, warehouseId: null, dispatched: false, movements: [], stocks: [] }))
afterEach(() => {
  wrapper?.unmount()
  clearNuxtData()
  activationRequired = true
})

describe('inventario de una cotización con compuestos', () => {
  it('avisa del bloqueo antes de activar y actualiza el aviso después de la activación', async () => {
    wrapper = await mountSuspended(InventoryOrderStock, {
      props: { orderId: 'activation-quote', version: 1 },
      global: { stubs: { InventoryWarehousePicker: true, InventoryStockTable: true } }
    })
    expect(wrapper.text()).toContain('Inventario pendiente de activación')
    expect(wrapper.text()).toContain('antes de confirmar o surtir')
    expect(wrapper.text()).not.toContain('Histórico sin control interno')
    activationRequired = false
    await wrapper.setProps({ version: 2 })
    await vi.waitFor(() => expect(wrapper?.text()).not.toContain('Inventario pendiente de activación'))
  })
})
