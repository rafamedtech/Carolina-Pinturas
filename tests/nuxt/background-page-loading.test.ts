// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from '#app'
import type { VueWrapper } from '@vue/test-utils'
import ProductEditor from '~/components/products/ProductEditor.vue'
import PurchaseDetail from '~/components/purchases/PurchaseDetail.vue'
import InventoryDashboard from '~/components/inventory/InventoryDashboard.vue'

mockNuxtImport('useAuth', () => () => ({ user: { value: { role: 'admin' } } }))

function deferred() {
  let resolve!: (value: unknown) => void
  const promise = new Promise((resolveValue) => {
    resolve = resolveValue
  })
  return { promise, resolve }
}
let context = deferred()
let product = deferred()
let purchase = deferred()
let warehouses = deferred()
let settings = deferred()
let stocks = deferred()
const started = new Set<string>()
registerEndpoint('/api/siigo/products/context', () => {
  started.add('context')
  return context.promise
})
registerEndpoint('/api/siigo/products/background-product', () => {
  started.add('product')
  return product.promise
})
registerEndpoint('/api/purchases/background-purchase', () => purchase.promise)
registerEndpoint('/api/inventory/warehouses', () => {
  started.add('warehouses')
  return warehouses.promise
})
registerEndpoint('/api/inventory/settings', () => {
  started.add('settings')
  return settings.promise
})
registerEndpoint('/api/inventory/stocks', () => {
  started.add('stocks')
  return stocks.promise
})
const stubs = {
  UDashboardPanel: { template: '<section><slot name="header" /><slot name="body" /></section>' },
  UDashboardNavbar: { props: ['title'], template: '<header><h1>{{ title }}</h1><slot name="leading" /><slot name="right" /></header>' },
  ProductsProductForm: { props: ['product'], template: '<form><input aria-label="Código" :value="product?.code" /></form>' },
  ProductsProductImageField: true,
  ListLayout: {
    props: ['config', 'loading', 'data'],
    template: '<section><h1>{{ config.title }}</h1><input aria-label="Buscar inventario" /><p v-if="loading" role="status">Cargando inventario</p><p v-else>{{ data.length }} registros</p></section>'
  }
}
let wrapper: VueWrapper | undefined
beforeEach(() => {
  clearNuxtData()
  context = deferred()
  product = deferred()
  purchase = deferred()
  warehouses = deferred()
  settings = deferred()
  stocks = deferred()
  started.clear()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  for (const pending of [context, product, purchase, warehouses, settings, stocks]) pending.resolve({})
  clearNuxtData()
})

describe('páginas con datos en segundo plano', () => {
  it('muestra el editor y consulta producto y opciones en paralelo sin inicializar un formulario vacío', async () => {
    wrapper = await mountSuspended(ProductEditor, {
      props: { productId: 'background-product' }, global: { stubs }
    })
    expect(wrapper.text()).toContain('Editar producto')
    expect(wrapper.text()).toContain('Cargando producto…')
    expect(wrapper.find('form').exists()).toBe(false)
    await vi.waitFor(() => expect([...started].sort()).toEqual(['context', 'product']))
    context.resolve({ accountGroups: [], taxes: [], priceLists: [] })
    await vi.waitFor(() => expect(wrapper?.text()).toContain('Cargando producto…'))
    expect(wrapper.find('form').exists()).toBe(false)
    product.resolve({ id: 'background-product', code: 'P001', name: 'Pintura blanca', type: 'Product' })
    await vi.waitFor(() => expect(wrapper?.find('form').exists()).toBe(true))
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('P001')
  })

  it('muestra el encabezado y la carga de una compra antes de que termine su consulta y comunica el error', async () => {
    wrapper = await mountSuspended(PurchaseDetail, {
      props: { id: 'background-purchase' }, global: { stubs }
    })
    expect(wrapper.get('h1').text()).toBe('Compra')
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    purchase.resolve(new Response(JSON.stringify({ statusMessage: 'Consulta no disponible' }), { status: 403 }))
    await vi.waitFor(() => expect(wrapper?.text()).toContain('No se pudo cargar la compra.'))
    expect(wrapper.get('h1').text()).toBe('Compra')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('permite usar el inventario mientras sus tres consultas independientes están pendientes', async () => {
    wrapper = await mountSuspended(InventoryDashboard, { global: { stubs } })
    expect(wrapper.get('h1').text()).toBe('Inventario')
    expect(wrapper.get('[role="status"]').text()).toContain('Cargando inventario')
    await wrapper.get('input').setValue('Pintura')
    await vi.waitFor(() => expect([...started].sort()).toEqual(['settings', 'stocks', 'warehouses']))
    stocks.resolve({ results: [], pagination: { page: 1, totalPages: 1, totalResults: 0 } })
    await vi.waitFor(() => expect(wrapper?.text()).toContain('0 registros'))
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('Pintura')
    warehouses.resolve({ results: [], pagination: { totalPages: 1 } })
    settings.resolve({ enabledAt: null })
  })
})
