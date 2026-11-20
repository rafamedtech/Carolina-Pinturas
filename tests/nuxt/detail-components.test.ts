// @vitest-environment nuxt
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { Component } from 'vue'
import type { VueWrapper } from '@vue/test-utils'
import { DetailTable } from '#components'
import DetailTabs from '~/components/detail/DetailTabs.vue'

let wrapper: VueWrapper | undefined
afterEach(() => wrapper?.unmount())

describe('componentes compartidos de producto e inventario', () => {
  it('conserva las celdas personalizadas y permite ocultar columnas desde el control externo', async () => {
    let table: { getColumns: () => Array<{ id: string, toggleVisibility: (visible: boolean) => void }> } | undefined
    const columnVisibility = ref<Record<string, boolean>>({})
    wrapper = await mountSuspended(defineComponent({
      setup: () => () => h(DetailTable as Component, {
        'ref': (instance: unknown) => { table = instance as typeof table },
        'aria-label': 'Inventario',
        'id': 'detail-table',
        'class': 'test-table',
        'caption': 'Inventario actual',
        'data': [{ id: 'paint', name: 'Pintura', quantity: 12 }],
        'getRowId': (row: { id: string }) => row.id,
        'columns': [{ accessorKey: 'name', header: 'Producto' }, { accessorKey: 'quantity', header: 'Existencia' }],
        'columnVisibility': columnVisibility.value,
        'onUpdate:columnVisibility': (value: Record<string, boolean>) => { columnVisibility.value = value }
      }, {
        'name-cell': ({ row }: { row: { id: string, original: { name: string } } }) => h('span', { 'data-row-id': row.id }, `Ficha de ${row.original.name}`)
      })
    }))
    const root = wrapper.get('#detail-table')
    expect(root.attributes('aria-label')).toBe('Inventario')
    expect(root.classes()).toContain('test-table')
    expect(root.classes()).not.toContain('hidden')
    expect(root.get('caption').text()).toBe('Inventario actual')
    expect(root.get('[data-row-id]').attributes('data-row-id')).toBe('paint')
    expect(wrapper.text()).toContain('Ficha de Pintura')
    expect(wrapper.text()).toContain('Existencia')
    table!.getColumns().find(column => column.id === 'quantity')!.toggleVisibility(false)
    await nextTick()
    expect(columnVisibility.value).toEqual({ quantity: false })
    expect(wrapper.text()).not.toContain('Existencia')
    expect(wrapper.text()).toContain('Ficha de Pintura')
  })

  it('conserva el mismo registro, la carga y el vacío en tarjetas y tabla', async () => {
    type Product = { id: string, name: string }
    const data = ref<Product[]>([{ id: 'paint', name: 'Pintura' }])
    const loading = ref(false)
    wrapper = await mountSuspended(defineComponent({
      setup: () => () => h(DetailTable as Component, {
        data: data.value,
        loading: loading.value,
        columns: [{ accessorKey: 'name', header: 'Producto' }],
        getRowId: (row: Product) => row.id
      }, {
        record: ({ row }: { row: Product }) => h('article', row.name),
        loading: () => h('p', 'Consultando existencias'),
        empty: () => h('p', 'Sin existencias')
      })
    }))

    const cards = wrapper.get('[class~="md:hidden"]')
    const desktop = wrapper.get('[class~="md:block"]')
    expect(desktop.classes()).toContain('hidden')
    expect(cards.get('article').text()).toBe('Pintura')
    expect(desktop.get('tbody td').text()).toBe('Pintura')

    data.value = []
    loading.value = true
    await nextTick()
    expect(cards.text()).toBe('Consultando existencias')
    expect(desktop.get('tbody td').text()).toBe('Consultando existencias')
    expect(wrapper.findAll('[role="status"]')).toHaveLength(1)

    loading.value = false
    await nextTick()
    expect(cards.text()).toBe('Sin existencias')
    expect(desktop.get('tbody td').text()).toBe('Sin existencias')
  })

  it('notifica la pestaña elegida sin perder su contenido', async () => {
    wrapper = await mountSuspended(DetailTabs, {
      props: { modelValue: 'stocks', items: [{ label: 'Existencias', value: 'stocks' }, { label: 'Reservas', value: 'reservations' }] },
      slots: { content: '<p>Contenido de la sección</p>' }
    })
    expect(wrapper.text()).toContain('Contenido de la sección')
    await wrapper.findAll('[role="tab"]').find(tab => tab.text() === 'Reservas')!.trigger('mousedown', { button: 0, ctrlKey: false })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['reservations'])
  })
})
