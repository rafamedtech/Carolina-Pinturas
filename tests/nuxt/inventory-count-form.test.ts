// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import InventoryCountForm from '~/components/inventory/InventoryCountForm.vue'
import type { InventoryCount } from '#shared/types/inventory'

const count: InventoryCount = {
  id: 'count-1', warehouseId: 'warehouse-1', warehouse: { name: 'Principal' }, status: 'borrador', version: 2,
  date: '2026-10-05', reason: 'Conteo selectivo', createdBy: 'prueba', movementId: null,
  lines: [{ productId: 'product-1', baseVersion: 1, expected: '10', counted: null, product: { code: 'P-1', name: 'Pintura blanca' } }]
}
const picker = { props: ['excludedIds', 'busy'], emits: ['add'], template: '<button type="button" @click="$emit(\'add\', \'product-2\')">Agregar segundo producto</button>' }
const mountForm = (value = count) => mountSuspended(InventoryCountForm, { props: { count: value, admin: true, busy: false, activated: true }, global: { stubs: { InventoryCountProductPicker: picker } } })

describe('Conteo físico selectivo', () => {
  it('captura costo y moneda en el conteo inicial y conserva seis decimales', async () => {
    const initial = { ...count, lines: [{ ...count.lines[0]!, counted: '5', unitCost: '12.123456', costCurrency: 'USD' }] }
    const wrapper = await mountForm(initial)
    await wrapper.setProps({ activated: false })
    expect(wrapper.find('input[aria-label="Costo unitario de Pintura blanca"]').exists()).toBe(true)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]).toEqual([{ action: 'countEdit', id: count.id, version: 2, lines: [{ productId: 'product-1', counted: '5', unitCost: '12.123456', costCurrency: 'USD' }] }])
    wrapper.unmount()
  })

  it('agrega productos y conserva las cantidades sin guardar de otras partidas', async () => {
    const wrapper = await mountForm()
    await wrapper.get('input[aria-label="Conteo de Pintura blanca"]').setValue('5.123456')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('submit')?.[0]).toEqual([{ action: 'countAdd', id: count.id, version: 2, productId: 'product-2' }])
    await wrapper.setProps({ count: { ...count, version: 3, lines: [...count.lines, { productId: 'product-2', baseVersion: 4, expected: '7', counted: null, product: { code: 'P-2', name: 'Pintura azul' } }] } })
    expect((wrapper.get('input[aria-label="Conteo de Pintura blanca"]').element as HTMLInputElement).value).toBe('5.123456')
    await wrapper.get('input[aria-label="Conteo de Pintura azul"]').setValue('0')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[1]).toEqual([{ action: 'countEdit', id: count.id, version: 3, lines: [{ productId: 'product-1', counted: '5.123456' }, { productId: 'product-2', counted: '0' }] }])
    await wrapper.get('button[aria-label="Quitar Pintura azul del conteo"]').trigger('click')
    expect(wrapper.emitted('submit')?.[2]).toEqual([{ action: 'countRemove', id: count.id, version: 3, productId: 'product-2' }])
    wrapper.unmount()
  })

  it('impide enviar conteos vacíos o con cantidades sin guardar y bloquea partidas pendientes', async () => {
    const wrapper = await mountForm({ ...count, lines: [] })
    const submitButton = () => wrapper.findAll('button').find(b => b.text() === 'Enviar para aprobación')!
    expect(submitButton().attributes('disabled')).toBeDefined()
    await wrapper.setProps({ count: { ...count, lines: [{ ...count.lines[0]!, counted: '5' }] } })
    expect(submitButton().attributes('disabled')).toBeUndefined()
    await wrapper.get('input[aria-label="Conteo de Pintura blanca"]').setValue('6')
    expect(submitButton().attributes('disabled')).toBeDefined()
    await wrapper.setProps({ count: { ...count, status: 'pendiente' } })
    expect(wrapper.find('button[aria-label="Quitar Pintura blanca del conteo"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Agregar segundo producto')
    wrapper.unmount()
  })
})
