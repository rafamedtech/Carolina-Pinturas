// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { h } from 'vue'
import ListRecordCard from '~/components/list/ListRecordCard.vue'
import AppButton from '~/components/AppButton.vue'

describe('card reutilizable de registros móviles', () => {
  it('navega con un enlace nativo y conserva el nombre accesible y los valores cero', async () => {
    const wrapper = await mountSuspended(ListRecordCard, {
      props: {
        title: 'PED-000123', to: { path: '/ventas/order-1', query: { returnTo: '/ventas' } },
        ariaLabel: 'Abrir pedido de Cliente', eyebrow: '09/11/2026',
        fields: [{ label: 'Cantidad', value: 0 }], summaryLabel: 'Total', summaryValue: '$0.00'
      },
      slots: { trailing: () => h('span', 'Entregado') }
    })
    expect(wrapper.get('a').attributes('href')).toBe('/ventas/order-1?returnTo=/ventas')
    expect(wrapper.get('a').attributes('aria-label')).toBe('Abrir pedido de Cliente')
    expect(wrapper.text()).toContain('Entregado')
    expect(wrapper.findAll('dd').map(item => item.text())).toEqual(['0', '$0.00'])
    expect(wrapper.find('a button').exists()).toBe(false)
    wrapper.unmount()
  })

  it('limita la navegación al título cuando recibe titleTo', async () => {
    const wrapper = await mountSuspended(ListRecordCard, {
      props: { title: 'PED-000123', titleTo: '/ventas/order-1', fields: [{ label: 'Cliente', value: 'Cliente' }] }
    })
    expect(wrapper.findAll('a')).toHaveLength(1)
    expect(wrapper.get('h3 a').attributes('href')).toBe('/ventas/order-1')
    expect(wrapper.find('.absolute.inset-0').exists()).toBe(false)
    await wrapper.get('dd').trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
    wrapper.unmount()
  })

  it('emite la selección de una card accionable y admite un resumen personalizado', async () => {
    const wrapper = await mountSuspended(ListRecordCard, {
      props: { title: 'Igualación', actionable: true },
      slots: { summary: () => h('p', '2 x BASE') }
    })
    const button = wrapper.get('button')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('aria-label')).toBe('Abrir Igualación')
    await button.trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)
    expect(wrapper.text()).toContain('2 x BASE')
    wrapper.unmount()
  })

  it('mantiene independientes las acciones y no agrega navegación a una card informativa', async () => {
    const action = vi.fn()
    const wrapper = await mountSuspended(ListRecordCard, {
      props: { title: 'Registro' },
      slots: { actions: () => h(AppButton, { label: 'Editar', onClick: action }) }
    })
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.findAll('button')).toHaveLength(1)
    await wrapper.get('button').trigger('click')
    expect(action).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('select')).toBeUndefined()
    wrapper.unmount()
  })
})
