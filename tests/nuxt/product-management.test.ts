// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import ProductForm from '~/components/products/ProductForm.vue'
import ProductFilters from '~/components/products/ProductFilters.vue'
import SatPicker from '~/components/products/SatPicker.vue'
import OrderDatePicker from '~/components/orders/OrderDatePicker.vue'
import { useProductMutation } from '~/composables/useProductMutation'
import type { SiigoProduct } from '~/types/siigo'
import { productMutationInput } from '~/utils/siigoProductMutation'

const id = '00000000-0000-4000-8000-000000000001'
const product: SiigoProduct = {
  id, code: 'PIN1', name: 'Pintura', type: 'Product', active: true,
  unit: { code: 'H87' }, key: { code: '31211500' }, account_group: { id: 10 },
  prices: [{ currency_code: 'MXN', price_list: [{ position: 1, value: 100 }] }, { currency_code: 'USD', price_list: [{ position: 2, value: 6 }] }]
}
const context = {
  accountGroups: [{ id: 10, name: 'Pinturas', active: true }],
  taxes: [{ id: 5, name: 'IVA 8%', active: true }],
  priceLists: [{ id: 1, name: 'Público', active: true }, { id: 2, name: 'Mayoreo', active: true }]
}
let wrapper: VueWrapper | undefined
registerEndpoint('/api/siigo/products/sat', async () => {
  await new Promise(resolve => setTimeout(resolve, 10))
  return { results: [{ code: 'H87', name: 'Pieza' }], pagination: { page: 1, page_size: 25, total_results: 1 }, retrievedAt: '2026-09-15', source: 'https://example.com' }
})
afterEach(() => {
  wrapper?.unmount()
})

describe('formulario de productos', () => {
  it('muestra campos, conserva monedas y bloquea envío mientras guarda', async () => {
    wrapper = await mountSuspended(ProductForm, { props: { product, context, saving: true, blocked: false } })
    expect(wrapper.text()).toContain('Información general')
    expect(wrapper.text()).toContain('Precios e impuestos')
    expect(wrapper.find('fieldset').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('input').map(input => input.element.value)).toEqual(expect.arrayContaining(['PIN1', 'Pintura', 'MXN', 'USD', '100', '6']))
  })
  it('no envía alta incompleta; muestra errores en español', async () => {
    wrapper = await mountSuspended(ProductForm, { props: { context, saving: false, blocked: false } })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('Escribe el código.')
    expect(wrapper.text()).toContain('Selecciona una unidad SAT.')
  })
  it('envía edición con los precios originales', async () => {
    wrapper = await mountSuspended(ProductForm, { props: { product, context, saving: false, blocked: false } })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ code: 'PIN1', prices: product.prices })
  })
  it('filtros reutilizan cuatro calendarios del proyecto', async () => {
    wrapper = await mountSuspended(ProductFilters)
    expect(wrapper.findAllComponents(OrderDatePicker)).toHaveLength(4)
    const apply = wrapper.findAll('button').find(button => button.text() === 'Aplicar filtros')!
    await apply.trigger('click')
    expect(wrapper.emitted('change')?.[0]?.[0]).toEqual({ active: 'true' })
  })
  it('mantiene la altura del selector SAT mientras carga los resultados', async () => {
    wrapper = await mountSuspended(SatPicker, {
      attachTo: document.body,
      props: { modelValue: '', kind: 'unit', label: 'Unidad SAT' }
    })
    await wrapper.get('button').trigger('click')

    const loading = document.querySelector('[role="status"]')
    expect(loading?.textContent).toContain('Cargando…')
    expect(document.querySelector('.h-96')).not.toBeNull()

    await vi.waitFor(() => expect(document.body.textContent).toContain('H87 · Pieza'))
    expect(document.querySelector('.h-96')).not.toBeNull()
  })
})

describe('guardado cliente sin duplicados', () => {
  it('envíos simultáneos hacen una sola llamada y no reintentan timeout', async () => {
    let mutation!: ReturnType<typeof useProductMutation>
    wrapper = await mountSuspended(defineComponent({ setup() {
      mutation = useProductMutation()
      return () => h('div')
    } }))
    const originalFetch = globalThis.$fetch
    let reject!: (error: unknown) => void
    const fetchMock = vi.fn((_url: string, _options: unknown) => new Promise((_, fail) => {
      reject = fail
    }))
    globalThis.$fetch = fetchMock as unknown as typeof $fetch
    try {
      const first = mutation.save(productMutationInput(product), id)
      const second = mutation.save(productMutationInput(product), id)
      reject({ statusCode: 504, data: { data: { ambiguous: true } } })
      await Promise.all([first, second])
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'PUT', retry: 0 })
      expect(mutation.ambiguous.value).toBe(true)
      await mutation.save(productMutationInput(product), id)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally { globalThis.$fetch = originalFetch }
  })
})
