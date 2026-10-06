// @vitest-environment nuxt
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { clearNuxtData } from '#app'
import InventoryMovementForm from '~/components/inventory/InventoryMovementForm.vue'
import type { InventoryMovement, InventoryProduct } from '#shared/types/inventory'

const mocks = vi.hoisted(() => ({ fetchAllPages: vi.fn() }))
vi.mock('~/composables/useCsvExport', () => ({ fetchAllPages: mocks.fetchAllPages }))
const product: InventoryProduct = { id: 'product-1', code: 'P-1', name: 'Pintura blanca', unit: 'Unidad', enabled: true, version: 1, initialUnitCost: '12.123456', initialCostCurrency: 'USD' }
const search = {
  props: ['products', 'disabled', 'loading'], emits: ['update:modelValue'],
  template: '<button type="button" data-testid="search" :disabled="disabled" @click="$emit(\'update:modelValue\', products[0].id)">{{ loading ? "Cargando" : products.map(p => p.name).join(", ") }}</button>'
}
const props = { warehouses: [{ id: 'warehouse-1', code: 'A', name: 'Principal', address: null, active: true, version: 1 }], activated: false, admin: true, busy: false }
const mountForm = (source?: InventoryMovement) => mountSuspended(InventoryMovementForm, { props: { ...props, source }, global: { stubs: { ProductsProductSearch: search } } })

beforeEach(() => {
  clearNuxtData('inventory-movement-products')
  mocks.fetchAllPages.mockReset()
})

describe('apertura del formulario de movimientos', () => {
  it('muestra el formulario antes de completar el catálogo y conserva costos al seleccionar', async () => {
    let resolve!: (products: InventoryProduct[]) => void
    mocks.fetchAllPages.mockReturnValue(new Promise<InventoryProduct[]>((done) => {
      resolve = done
    }))
    const wrapper = await mountForm()
    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.get('[role="status"]').text()).toBe('Cargando productos…')
    expect(wrapper.get('[data-testid="search"]').attributes('disabled')).toBeDefined()
    expect(mocks.fetchAllPages).toHaveBeenCalledWith('/api/inventory/products', { controlledOnly: 'true' }, 100, expect.any(Function))
    resolve([product])
    await flushPromises()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="search"]').text()).toContain(product.name)
    await wrapper.get('[data-testid="search"]').trigger('click')
    const add = wrapper.findAll('button').find(b => b.text() === 'Agregar producto')!
    await add.trigger('click')
    expect(wrapper.get('input[aria-label="Costo unitario de P-1 · Pintura blanca"]').attributes('aria-valuenow')).toBe('12.123456')
    expect(wrapper.text()).toContain('USD')
    wrapper.unmount()
  })

  it('permite reintentar un error sin ocultar el formulario ni perder el motivo', async () => {
    mocks.fetchAllPages.mockRejectedValueOnce(new Error('Catálogo no disponible')).mockResolvedValueOnce([product])
    const wrapper = await mountForm()
    await flushPromises()
    await wrapper.get('textarea').setValue('Motivo conservado')
    expect(wrapper.get('[role="alert"]').text()).toContain('No se pudieron cargar los productos.')
    const retry = wrapper.findAll('button').find(b => b.text() === 'Reintentar')!
    await retry.trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('Motivo conservado')
    expect(wrapper.get('[data-testid="search"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('no consulta el catálogo al devolver productos de un movimiento', async () => {
    const source: InventoryMovement = { id: 'movement-1', folio: 1, type: 'entrada', date: '2026-10-06', reason: 'Entrada', actorName: 'Prueba', actorEmail: 'prueba@example.test', createdAt: '2026-10-06T12:00:00Z', originKey: 'origin-1', orderId: null, receiptId: null, reversalOfId: null, sourceMovementId: null, reversal: null, lines: [{ id: 'line-1', productId: product.id, warehouseId: 'warehouse-1', productCode: product.code, productName: product.name, warehouseName: 'Principal', unitName: 'Unidad', delta: '2', balanceAfter: '2' }] }
    const wrapper = await mountForm(source)
    expect(wrapper.text()).toContain('Devolución vinculada al movimiento INV-1')
    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(mocks.fetchAllPages).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
