// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import { defineEventHandler } from 'h3'
import { useCustomersCatalog } from '~/composables/useCustomersCatalog'

let requestCount = 0
let refreshCount = 0

registerEndpoint('/api/siigo/customers', () => {
  requestCount += 1
  return {
    results: [],
    pagination: {
      page: 1,
      page_size: 100,
      total_results: 0
    }
  }
})

registerEndpoint('/api/siigo/customers/sync', {
  method: 'POST',
  handler: defineEventHandler(() => {
    refreshCount += 1
    return {
      results: [{ id: 'supplier-1', name: ['Proveedor actualizado'], type: 'Supplier' }],
      pagination: { page: 1, page_size: 1, total_results: 1 }
    }
  })
})

const CatalogProbe = defineComponent({
  setup() {
    const { status } = useCustomersCatalog({ immediate: false })
    return () => h('span', status.value)
  }
})

const RefreshProbe = defineComponent({
  setup() {
    const { data, refresh } = useCustomersCatalog({ customerType: 'Supplier' })
    return () => h('button', { onClick: refresh }, data.value?.results[0]?.name?.[0] || 'Vacío')
  }
})

afterEach(() => {
  requestCount = 0
  refreshCount = 0
  clearNuxtData('customers-catalog-request')
  clearNuxtData('customers-catalog-request-supplier')
})

describe('useCustomersCatalog', () => {
  it('no solicita el catálogo local cuando la carga está desactivada', async () => {
    const wrapper = await mountSuspended(CatalogProbe)
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(requestCount).toBe(0)
    expect(wrapper.text()).toBe('idle')

    wrapper.unmount()
  })

  it('reemplaza el catálogo con la respuesta fresca del mismo POST', async () => {
    const wrapper = await mountSuspended(RefreshProbe)
    await wrapper.get('button').trigger('click')

    await vi.waitFor(() => expect(wrapper.text()).toBe('Proveedor actualizado'))
    expect(refreshCount).toBe(1)
    expect(requestCount).toBe(1)

    wrapper.unmount()
  })
})
