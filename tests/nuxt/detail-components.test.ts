// @vitest-environment nuxt
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h, nextTick } from 'vue'
import type { Component } from 'vue'
import type { VueWrapper } from '@vue/test-utils'
import DetailTable from '~/components/detail/DetailTable.vue'
import DetailTabs from '~/components/detail/DetailTabs.vue'

let wrapper: VueWrapper | undefined
afterEach(() => wrapper?.unmount())

describe('componentes compartidos de producto e inventario', () => {
  it('conserva las celdas personalizadas y permite ocultar columnas desde el control externo', async () => {
    let table: { getColumns: () => Array<{ id: string, toggleVisibility: (visible: boolean) => void }> } | undefined
    wrapper = await mountSuspended(defineComponent({
      setup: () => () => h(DetailTable as Component, {
        ref: (instance: unknown) => { table = instance as typeof table },
        data: [{ name: 'Pintura', quantity: 12 }],
        columns: [{ accessorKey: 'name', header: 'Producto' }, { accessorKey: 'quantity', header: 'Existencia' }]
      }, {
        'name-cell': ({ row }: { row: { original: { name: string } } }) => h('span', `Ficha de ${row.original.name}`)
      })
    }))
    expect(wrapper.text()).toContain('Ficha de Pintura')
    expect(wrapper.text()).toContain('Existencia')
    table!.getColumns().find(column => column.id === 'quantity')!.toggleVisibility(false)
    await nextTick()
    expect(wrapper.text()).not.toContain('Existencia')
    expect(wrapper.text()).toContain('Ficha de Pintura')
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
