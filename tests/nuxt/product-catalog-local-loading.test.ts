// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from '#app'
import { getQuery, createError } from 'h3'
import type { VueWrapper } from '@vue/test-utils'
import ProductCatalog from '~/components/products/ProductCatalog.vue'

mockNuxtImport('useAuth', () => () => ({ user: { value: { role: 'admin' } } }))
const original = { id: 'product-1', code: 'P001', name: 'Pintura local', type: 'Product', active: true, unit: { code: 'H87', name: 'Pieza' } }
let rows = [original]
let syncCount = 0
let readCount = 0
let detailCount = 0
let failSync = false
registerEndpoint('/api/siigo/products', (event) => {
  if (getQuery(event).refresh === 'true') {
    syncCount++
    if (failSync) throw createError({ statusCode: 502, statusMessage: 'Siigo temporalmente no disponible' })
    rows = [{ ...original, name: 'Pintura sincronizada' }]
  } else readCount++
  return { results: rows, pagination: { page: 1, page_size: rows.length, total_results: rows.length } }
})
registerEndpoint('/api/siigo/products/product-1', () => {
  detailCount++
  return original
})
const stubs = {
  ListLayout: {
    props: ['config', 'data', 'loading', 'error', 'errorMessage'], emits: ['refresh'],
    template: '<section><h1>{{ config.title }}</h1><button @click="$emit(\'refresh\')">Actualizar</button><p v-if="loading" role="status">Cargando</p><p v-else>{{ data.map(p => p.name).join(", ") }}</p><p v-if="error" role="alert">{{ errorMessage }}</p></section>'
  }
}
let wrapper: VueWrapper | undefined
beforeEach(() => {
  rows = [original]
  syncCount = readCount = detailCount = 0
  failSync = false
  clearNuxtData()
})
afterEach(() => {
  wrapper?.unmount()
  clearNuxtData()
})

describe('carga local y actualización explícita del catálogo de productos', () => {
  it('termina la carga inicial desde PostgreSQL sin sincronizar ni hacer consultas por cada fila', async () => {
    wrapper = await mountSuspended(ProductCatalog, { global: { stubs } })
    await vi.waitFor(() => expect(wrapper?.text()).toContain('Pintura local'))
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(readCount).toBe(1)
    expect(syncCount).toBe(0)
    expect(detailCount).toBe(0)
  })
  it('solo sincroniza al pulsar Actualizar y vuelve a salir del estado de carga', async () => {
    wrapper = await mountSuspended(ProductCatalog, { global: { stubs } })
    await vi.waitFor(() => expect(wrapper?.text()).toContain('Pintura local'))
    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => expect(wrapper?.text()).toContain('Pintura sincronizada'))
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(syncCount).toBe(1)
    expect(readCount).toBe(2)
    expect(detailCount).toBe(0)
  })
  it('sale del estado de carga si Siigo falla y conserva los datos locales para reintentar', async () => {
    wrapper = await mountSuspended(ProductCatalog, { global: { stubs } })
    await vi.waitFor(() => expect(wrapper?.text()).toContain('Pintura local'))
    failSync = true
    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => expect(wrapper?.find('[role="alert"]').text()).toContain('Siigo temporalmente no disponible'))
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Pintura local')
    failSync = false
    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => expect(wrapper?.text()).toContain('Pintura sincronizada'))
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})
