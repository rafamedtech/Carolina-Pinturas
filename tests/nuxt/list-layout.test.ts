// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { parseDate } from '@internationalized/date'
import { defineComponent, h, ref } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { ListLayoutConfig } from '~/types/list'
import ListLayout from '~/components/list/ListLayout.vue'
import ListFiltersModal from '~/components/list/ListFiltersModal.vue'
import ListFilterFields from '~/components/list/ListFilterFields.vue'
import OrderDatePicker from '~/components/orders/OrderDatePicker.vue'
import { useListFilterBindings } from '~/composables/useListFilterBindings'

interface RecordItem { id: string, name: string }
const Layout = ListLayout<RecordItem>
const columns: TableColumn<RecordItem>[] = [{ accessorKey: 'name', header: 'Nombre' }]
const config: ListLayoutConfig = {
  id: 'test-list', title: 'Registros', empty: 'Sin registros.',
  search: { placeholder: 'Buscar registro' }, dateFilter: { subject: 'registros' },
  tabs: [{ label: 'Todos', value: 'all' }, { label: 'Activos', value: 'active' }],
  filters: [
    { key: 'hidden', label: 'Ocultar registros', type: 'checkbox', defaultValue: false },
    { key: 'method', label: 'Método', type: 'select', defaultValue: 'all', items: [{ label: 'Todos', value: 'all' }, { label: 'Efectivo', value: 'cash' }] }
  ],
  create: { label: 'Nuevo registro' }, pagination: { mode: 'client', label: 'registros', pageSize: 25 }
}
let wrapper: VueWrapper | undefined
afterEach(() => wrapper?.unmount())

describe('layout configurable de listados', () => {
  it('renderiza controles y columnas configurados y centraliza la limpieza completa', async () => {
    wrapper = await mountSuspended(Layout, {
      props: {
        embedded: true, config, data: [{ id: '1', name: 'Pintura' }], columns,
        search: 'PED-1', tab: 'active', filters: { hidden: true, method: 'cash' }, page: 2,
        dateRange: { start: parseDate('2026-10-01'), end: parseDate('2026-10-18') }
      }
    })
    expect(wrapper.text()).toContain('Nombre')
    expect(wrapper.text()).toContain('Pintura')
    expect(wrapper.findAll('table')).toHaveLength(1)
    expect(wrapper.text()).toContain('Más filtros')
    expect(wrapper.text()).toContain('Nuevo registro')
    expect(wrapper.findAllComponents(OrderDatePicker)).toHaveLength(0)
    await wrapper.findAll('button').find(button => button.text() === 'Quitar filtros')!.trigger('click')
    expect(wrapper.emitted('update:search')?.[0]).toEqual([''])
    expect(wrapper.emitted('update:tab')?.[0]).toEqual(['all'])
    expect(wrapper.emitted('update:dateRange')?.[0]).toEqual([null])
    expect(wrapper.emitted('update:filters')?.[0]).toEqual([{ hidden: false, method: 'all' }])
    await wrapper.findAll('button').find(button => button.text() === 'Nuevo registro')!.trigger('click')
    expect(wrapper.emitted('create')).toHaveLength(1)
  })

  it('muestra un único spinner con Cargando y oculta tabla y tarjetas durante la carga', async () => {
    wrapper = await mountSuspended(Layout, {
      props: { embedded: true, config, data: [], columns, loading: true },
      slots: { mobile: () => h('p', 'Tarjetas del módulo') }
    })
    expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
    expect(wrapper.get('[role="status"]').text()).toBe('Cargando')
    expect(wrapper.find('[role="status"] .animate-spin').exists()).toBe(true)
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Tarjetas del módulo')
    await wrapper.setProps({ loading: false, data: [{ id: '1', name: 'Pintura azul' }] })
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Tarjetas del módulo')
    expect(wrapper.text()).toContain('Pintura azul')
  })

  it('permite ocultar controles y deshabilitar Nuevo según permisos', async () => {
    wrapper = await mountSuspended(Layout, {
      props: { embedded: true, config: { id: 'read-only', title: 'Consulta', empty: 'Sin datos', create: { disabled: true, reason: 'Sin permiso' } }, data: [], columns }
    })
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Más filtros')
    const create = wrapper.findAll('button').find(button => button.text() === 'Nuevo')!
    expect(create.attributes('disabled')).toBeDefined()
    expect(create.attributes('title')).toBe('Sin permiso')
  })

  it('configura Nuevo como enlace con returnTo y como menú de tipos de alta', async () => {
    wrapper = await mountSuspended(Layout, {
      props: { embedded: true, config: { ...config, create: { label: 'Nueva compra', to: '/compras/nueva?returnTo=/compras' } }, data: [], columns }
    })
    expect(wrapper.get('a').attributes('href')).toBe('/compras/nueva?returnTo=/compras')
    await wrapper.setProps({ config: { ...config, create: { items: [{ label: 'Cotización', to: '/ventas/nueva-cotizacion' }] } } })
    const trigger = wrapper.findAll('button').find(button => button.text() === 'Nuevo')!
    expect(trigger.attributes('aria-haspopup')).toBe('menu')
  })

  it('aplica los filtros en borrador de una sola vez y descarta cambios al cancelar', async () => {
    const values = { hidden: false, method: 'cash' }
    wrapper = await mountSuspended(ListFiltersModal, { attachTo: document.body, props: { open: false, fields: config.filters!, values } })
    await wrapper.setProps({ open: true })
    const dialog = () => new DOMWrapper(document.querySelector('[role="dialog"]')!)
    await vi.waitFor(() => expect(dialog().find('[role="checkbox"]').exists()).toBe(true))
    await dialog().get('[role="checkbox"]').trigger('click')
    expect(values.hidden).toBe(false)
    expect(wrapper.emitted('apply')).toBeUndefined()
    await dialog().findAll('button').find(button => button.text() === 'Cancelar')!.trigger('click')
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    expect(wrapper.findComponent(ListFilterFields).props('modelValue')).toEqual(values)
    await dialog().get('[role="checkbox"]').trigger('click')
    await dialog().findAll('button').find(button => button.text() === 'Aplicar filtros')!.trigger('click')
    expect(wrapper.emitted('apply')?.[0]).toEqual([{ hidden: true, method: 'cash' }])
  })

  it('adapta los modelos del layout a los refs de consulta existentes sin aceptar tipos incorrectos', async () => {
    const active = ref('all')
    const hidden = ref(false)
    const changed = vi.fn()
    wrapper = await mountSuspended(defineComponent({ setup() {
      const model = useListFilterBindings({ active, hidden })
      return () => h('button', { onClick: () => {
        model.value = { active: 'true', hidden: true }
        changed(model.value)
        model.value = { active: false, hidden: 'incorrecto' }
      } }, 'Aplicar')
    } }))
    await wrapper.get('button').trigger('click')
    expect(active.value).toBe('true')
    expect(hidden.value).toBe(true)
    expect(changed).toHaveBeenCalledWith({ active: 'true', hidden: true })
  })
})
