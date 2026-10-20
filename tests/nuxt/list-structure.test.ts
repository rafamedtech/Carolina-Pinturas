// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h, ref } from 'vue'
import type { VueWrapper } from '@vue/test-utils'
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import { UDashboardGroup, UDropdownMenu } from '#components'
import { useListTableColumns } from '~/composables/useListTableColumns'
import ListPage from '~/components/list/ListPage.vue'
import ListToolbar from '~/components/list/ListToolbar.vue'
import ListViews from '~/components/list/ListViews.vue'
import ListTable from '~/components/list/ListTable.vue'
import ListPagination from '~/components/list/ListPagination.vue'

interface CatalogRecord { id: string, name: string }
const CatalogTable = ListTable<CatalogRecord>

let wrapper: VueWrapper | undefined
afterEach(() => wrapper?.unmount())

describe('estructura compartida de listados', () => {
  it('conserva filtros y overlays ante errores, permite recargar y recupera tabla y paginación', async () => {
    const error = ref(true)
    const refresh = vi.fn(() => {
      error.value = false
    })
    wrapper = await mountSuspended(defineComponent({
      setup: () => () => h(UDashboardGroup, {}, {
        default: () => h(ListPage, {
          id: 'list-test', title: 'Productos', error: error.value,
          errorMessage: 'No se pudo cargar el catálogo.', onRefresh: refresh
        }, {
          toolbar: () => h('input', { 'aria-label': 'Buscar producto' }),
          default: () => h('p', 'Pintura blanca'),
          pagination: () => h('p', 'Página actual'),
          overlays: () => h('p', 'Formulario del módulo')
        })
      })
    }))
    expect(wrapper.text()).toContain('No se pudo cargar el catálogo.')
    expect(wrapper.text()).toContain('Formulario del módulo')
    expect(wrapper.find('input[aria-label="Buscar producto"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Pintura blanca')
    expect(wrapper.text()).not.toContain('Página actual')
    await wrapper.get('button[aria-label="Actualizar productos"]').trigger('click')
    expect(refresh).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('Pintura blanca')
    expect(wrapper.text()).toContain('Página actual')
    expect(wrapper.text()).not.toContain('No se pudo cargar el catálogo.')
  })

  it('expone búsqueda y limpieza sin borrar los filtros específicos por su cuenta', async () => {
    wrapper = await mountSuspended(ListToolbar, {
      props: { search: '', placeholder: 'Buscar cliente', hasActiveFilters: true },
      slots: { filters: () => h('span', 'Filtro propio'), actions: () => h('button', 'Nuevo cliente') }
    })
    await wrapper.get('input[aria-label="Buscar cliente"]').setValue('Carolina')
    expect(wrapper.emitted('update:search')?.[0]).toEqual(['Carolina'])
    await wrapper.findAll('button').find(button => button.text() === 'Quitar filtros')!.trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
    expect(wrapper.text()).toContain('Filtro propio')
    expect(wrapper.text()).toContain('Nuevo cliente')
  })

  it('cambia la vista por estado sin crear paneles de contenido duplicados', async () => {
    wrapper = await mountSuspended(ListViews, {
      props: { modelValue: 'all', label: 'Estado', items: [{ label: 'Todos', value: 'all' }, { label: 'Confirmados', value: 'confirmado' }] }
    })
    await wrapper.get('[role="tab"][data-state="inactive"]').trigger('mousedown', { button: 0, ctrlKey: false })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['confirmado'])
    expect(wrapper.find('[role="tabpanel"]').exists()).toBe(false)
  })

  it('respeta orden, visibilidad, selección y estado de carga con tipos de registro propios', async () => {
    const select = vi.fn()
    const rows = [{ id: 'b', name: 'Blanco' }, { id: 'a', name: 'Azul' }]
    const columns: TableColumn<typeof rows[number]>[] = [
      { accessorKey: 'name', header: 'Nombre' }, { accessorKey: 'id', header: 'Clave' }
    ]
    wrapper = await mountSuspended(CatalogTable, {
      props: { data: rows, columns, empty: 'Sin productos', onSelect: select, sorting: [{ id: 'name', desc: false }], columnVisibility: { id: false } }
    })
    expect(wrapper.findAll('tbody tr').map(row => row.text())).toEqual(['Azul', 'Blanco'])
    expect(wrapper.text()).not.toContain('Clave')
    await wrapper.findAll('tbody tr')[0]!.trigger('click')
    expect(select.mock.calls[0]?.[1].original).toEqual(rows[1])
    await wrapper.setProps({ loading: true })
    expect(wrapper.find('[role="status"]').text()).toBe('Cargando')
    expect(wrapper.find('[role="status"] [class*="animate-spin"]').exists()).toBe(true)
    expect(wrapper.find('table').exists()).toBe(false)
    await wrapper.setProps({ loading: false })
    expect(wrapper.findAll('tbody tr').map(row => row.text())).toEqual(['Azul', 'Blanco'])
    await wrapper.setProps({ data: [] })
    expect(wrapper.text()).toContain('Sin productos')
  })

  it('pagina catálogos completos después de ordenar y ajusta la página si disminuyen los resultados', async () => {
    const rows = Array.from({ length: 53 }, (_, index) => ({ id: String(index), name: String(53 - index).padStart(2, '0') }))
    const columns: TableColumn<CatalogRecord>[] = [{ accessorKey: 'name', header: 'Nombre' }]
    wrapper = await mountSuspended(CatalogTable, {
      props: { data: [], columns, empty: 'Sin productos', page: 3, pageSize: 25, loading: true, sorting: [{ id: 'name', desc: false }] }
    })
    expect(wrapper.emitted('update:page')).toBeUndefined()
    await wrapper.setProps({ data: rows, loading: false })
    expect(wrapper.findAll('tbody tr').map(row => row.text())).toEqual(['51', '52', '53'])
    await wrapper.setProps({ data: rows.slice(0, 26) })
    expect(wrapper.emitted('update:page')?.[0]).toEqual([2])
    await wrapper.setProps({ page: 2 })
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    // Without a page model the API's current rows are never paginated again.
    wrapper.unmount()
    wrapper = await mountSuspended(CatalogTable, { props: { data: rows, columns, empty: 'Sin productos' } })
    expect(wrapper.findAll('tbody tr')).toHaveLength(53)
  })

  it('personaliza columnas con etiquetas legibles y conserva al menos una visible', async () => {
    const { sortableHeader } = useListTableColumns<CatalogRecord>()
    wrapper = await mountSuspended(CatalogTable, {
      props: {
        data: [{ id: '1', name: 'Azul' }], empty: 'Sin productos',
        columns: [{ accessorKey: 'id', header: 'Clave' }, { accessorKey: 'name', header: sortableHeader('Nombre') }],
        columnVisibility: { id: false }
      }
    })
    // Vue Test Utils infers generic Nuxt UI components as DOM wrappers.
    const dropdown = wrapper.findComponent(UDropdownMenu) as unknown as { props: (key: 'items') => DropdownMenuItem[] }
    const menu = () => dropdown.props('items')
    expect(menu()).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Clave', checked: false }),
      expect.objectContaining({ label: 'Nombre', checked: true, disabled: true })
    ]))
    const item = menu()[0] as { onUpdateChecked?: (checked: boolean) => void }
    item.onUpdateChecked!(true)
    await vi.waitFor(() => expect(wrapper!.findAll('th')).toHaveLength(2))
    expect(wrapper.emitted('update:columnVisibility')?.[0]).toEqual([{ id: true }])
    expect(menu()).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Nombre', disabled: false })]))
  })

  it('muestra rangos y totales, cambia de página y bloquea la navegación al cargar', async () => {
    wrapper = await mountSuspended(ListPagination, {
      props: { page: 1, totalResults: 53, pageSize: 25, label: 'pagos', filteredTotal: 1250, totalLabel: 'Total recibido:' }
    })
    expect(wrapper.text()).toContain('Mostrando 1–25 de 53 pagos')
    expect(wrapper.text()).toContain('Total recibido:')
    expect(wrapper.text()).toContain('1,250.00')
    await wrapper.findAll('button').find(button => button.text() === '2')!.trigger('click')
    expect(wrapper.emitted('update:page')?.[0]).toEqual([2])
    await wrapper.setProps({ page: 3, loading: true })
    expect(wrapper.text()).toContain('Mostrando 51–53 de 53 pagos')
    expect(wrapper.findAll('button').every(button => button.attributes('disabled') !== undefined)).toBe(true)
    await wrapper.setProps({ totalResults: 0 })
    expect(wrapper.text()).toBe('')
  })
})
