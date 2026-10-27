<script setup lang="ts">
import type { ListLayoutConfig } from '~/types/list'
import { tableQueryField, tableQueryText, tableQueryPage } from '~/utils/tableQuery'
import type { TableColumn, TableRow } from '@nuxt/ui'
import type { Repartidor } from '~/types/orders'
import type { CsvColumn } from '~/utils/csv'

const filter = ref('')
const page = shallowRef(1)
const pageSize = 25
const { returnTo } = useTableQuery([
  tableQueryField('search', filter, tableQueryText()),
  tableQueryField('page', page, tableQueryPage)
], { page, resetOn: [filter] })
const router = useRouter()
const { data, status, error, refresh, addToCatalog } = useRepartidoresCatalog({ all: true })

const loading = computed(() => status.value === 'idle' || status.value === 'pending')

const repartidores = computed(() => {
  const value = filter.value.trim().toLowerCase()
  if (!value) return data.value

  return data.value.filter(repartidor =>
    `${repartidor.nombre} ${repartidor.telefono || ''}`.toLowerCase().includes(value)
  )
})

const csvColumns: CsvColumn<Repartidor>[] = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'telefono', label: 'Teléfono', value: row => row.telefono || '' },
  { key: 'deliveredCount', label: 'Pedidos entregados', value: row => row.deliveredCount },
  { key: 'activo', label: 'Estado', value: row => row.activo === false ? 'Inactivo' : 'Activo' }
]

const columns: TableColumn<Repartidor>[] = [{
  accessorKey: 'nombre',
  header: 'Nombre'
}, {
  id: 'telefono',
  header: 'Teléfono',
  cell: ({ row }) => row.original.telefono || '—'
}, {
  id: 'deliveredCount',
  header: 'Pedidos entregados',
  cell: ({ row }) => row.original.deliveredCount
}, {
  accessorKey: 'activo',
  header: 'Estado',
  cell: ({ row }) => row.getValue('activo') === false ? 'Inactivo' : 'Activo'
}]

const message = computed(() => error.value?.data?.statusMessage || 'No fue posible cargar los repartidores.')

function openRepartidor(_: Event, row: TableRow<Repartidor>) {
  router.push({ path: `/repartidores/${encodeURIComponent(row.original.id)}`, query: { returnTo: returnTo.value } })
}
const createOpen = shallowRef(false)
const listConfig: ListLayoutConfig = {
  id: 'repartidores', title: 'Repartidores', empty: 'No hay repartidores para mostrar.',
  search: { placeholder: 'Buscar repartidor' }, create: { label: 'Nuevo repartidor' },
  pagination: { mode: 'client', label: 'repartidores', pageSize }
}
</script>

<template>
  <ListLayout
    v-model:search="filter"
    v-model:page="page"
    :config="listConfig"
    :data="repartidores"
    :columns="columns"
    :loading="loading"
    :error="Boolean(error)"
    :error-message="message"
    @refresh="refresh()"
    @create="createOpen = true"
    @select="openRepartidor"
  >
    <template #actions>
      <AppCsvExportButton
        filename="repartidores"
        :columns="csvColumns"
        :rows="repartidores"
        :disabled="loading"
      />
    </template>
    <template #overlays>
      <OrdersOrderRepartidorAddModal v-model:open="createOpen" hide-trigger @created="addToCatalog" />
    </template>
  </ListLayout>
</template>
