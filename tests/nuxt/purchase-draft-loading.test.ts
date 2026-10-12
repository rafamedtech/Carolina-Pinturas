// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from '#app'
import PurchaseDraftForm from '~/components/purchases/PurchaseDraftForm.vue'

type Catalog = { results: { id: string, name: string | string[] }[] }
let resolveSuppliers: (value: Catalog) => void
let resolveProducts: (value: Catalog) => void

registerEndpoint('/api/siigo/customers', () => new Promise<Catalog>((resolve) => {
  resolveSuppliers = resolve
}))
registerEndpoint('/api/siigo/products', () => new Promise<Catalog>((resolve) => {
  resolveProducts = resolve
}))

afterEach(() => clearNuxtData())

describe('carga del formulario de compra', () => {
  it('muestra el formulario con ambos catálogos pendientes y conserva la captura al cargarlos', async () => {
    const wrapper = await mountSuspended(PurchaseDraftForm, {
      props: { busy: false },
      global: {
        stubs: {
          UTooltip: { template: '<span><slot /></span>' },
          USelectMenu: {
            props: ['items', 'loading', 'disabled'],
            template: '<button data-testid="supplier" :disabled="disabled">{{ loading ? "Cargando proveedores" : items.map(i => i.label).join(", ") }}</button>'
          },
          ProductsProductSearch: {
            props: ['products', 'loading', 'disabled'],
            template: '<button data-testid="product" :disabled="disabled">{{ loading ? "Cargando productos" : products.map(p => p.name).join(", ") }}</button>'
          }
        }
      }
    })

    expect(wrapper.text()).toContain('Datos de la compra')
    expect(wrapper.text()).toContain('Cargando catálogos de Siigo…')
    expect(wrapper.get('[data-testid="supplier"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="product"]').attributes('disabled')).toBeDefined()
    await wrapper.get('textarea').setValue('Entrega por la mañana')
    await vi.waitFor(() => {
      expect(resolveSuppliers).toBeTypeOf('function')
      expect(resolveProducts).toBeTypeOf('function')
    })

    resolveSuppliers({ results: [{ id: 'supplier-1', name: ['Proveedor de prueba'] }] })
    await vi.waitFor(() => expect(wrapper.get('[data-testid="supplier"]').text()).toBe('Proveedor de prueba'))
    expect(wrapper.get('[data-testid="supplier"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="product"]').text()).toBe('Cargando productos')

    resolveProducts({ results: [{ id: 'product-1', name: 'Pintura blanca' }] })
    await vi.waitFor(() => expect(wrapper.get('[data-testid="product"]').text()).toBe('Pintura blanca'))
    expect(wrapper.get('[data-testid="product"]').attributes('disabled')).toBeUndefined()
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('Entrega por la mañana')
    wrapper.unmount()
  })
})
