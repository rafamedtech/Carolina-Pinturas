// @vitest-environment nuxt
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import { useCustomersCatalog } from '~/composables/useCustomersCatalog'

let requestCount = 0

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

const CatalogProbe = defineComponent({
  setup() {
    const { status } = useCustomersCatalog({ immediate: false })
    return () => h('span', status.value)
  }
})

afterEach(() => {
  requestCount = 0
  clearNuxtData('customers-catalog-request')
})

describe('useCustomersCatalog', () => {
  it('no solicita el catálogo de Siigo cuando la carga está desactivada', async () => {
    const wrapper = await mountSuspended(CatalogProbe)
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(requestCount).toBe(0)
    expect(wrapper.text()).toBe('idle')

    wrapper.unmount()
  })
})
