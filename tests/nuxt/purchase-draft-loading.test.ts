// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from '#app'
import PurchaseDraftForm from '~/components/purchases/PurchaseDraftForm.vue'
import type { PurchaseView } from '~/types/purchases'
import { mexicoToday } from '~/utils/datetime'

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
  it('duplica los datos editables con fecha de hoy y guarda una copia independiente sin movimientos', async () => {
    const source: PurchaseView = {
      id: 'purchase-1', folio: 42, status: 'confirmada', version: 3,
      providerId: 'supplier-1', providerName: 'Proveedor de prueba', providerRfc: null,
      date: '2025-01-01', currencyCode: 'USD', subtotal: 50, vatRate: 16, vatAmount: 8,
      total: 58, balance: 58, invoiced: 58, notes: 'Entrega por la mañana', receiptStatus: 'completa',
      items: [{ id: 'item-1', productId: 'product-1', code: 'P001', name: 'Pintura blanca', quantity: 2.5, unitCost: 20, total: 50, received: 2.5 }],
      receipts: [{ id: 'receipt-1', date: '2025-01-02', voidedAt: null, voidReason: null, items: [{ itemId: 'item-1', quantity: 2.5 }] }],
      invoices: [{ id: 'invoice-1', folio: 'F001', date: '2025-01-02', dueDate: '2025-02-02', amount: 58, balance: 58, status: 'pendiente', voidedAt: null, voidReason: null, payments: [] }],
      events: [{ id: 'event-1', action: 'confirm', createdBy: 'admin', createdAt: '2025-01-01T12:00:00Z', detail: {} }]
    }
    const original = structuredClone(source)
    const wrapper = await mountSuspended(PurchaseDraftForm, {
      props: { busy: false, copyFrom: source },
      global: { stubs: { UTooltip: { template: '<span><slot /></span>' } } }
    })

    expect(wrapper.text()).toContain('Pintura blanca')
    expect(wrapper.text()).toContain('Guardar borrador')
    expect(wrapper.text()).not.toContain('Guardar cambios')
    await vi.waitFor(() => {
      expect(resolveSuppliers).toBeTypeOf('function')
      expect(resolveProducts).toBeTypeOf('function')
    })
    resolveSuppliers({ results: [{ id: 'supplier-1', name: ['Proveedor de prueba'] }] })
    resolveProducts({ results: [{ id: 'product-1', name: 'Pintura blanca' }] })
    await vi.waitFor(() => expect(wrapper.text()).not.toContain('Cargando catálogos de Siigo…'))
    await wrapper.get('textarea').setValue('Notas de la copia')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('save')?.[0]?.[0]).toEqual({
      providerId: 'supplier-1', date: mexicoToday(), currencyCode: 'USD', vatRate: 16,
      notes: 'Notas de la copia', items: [{ productId: 'product-1', quantity: 2.5, unitCost: 20 }]
    })
    expect(source).toEqual(original)
    wrapper.unmount()
  })

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
