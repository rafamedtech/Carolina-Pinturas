<script setup lang="ts">
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

const isHydrated = shallowRef(false)
onMounted(() => {
  isHydrated.value = true
})
const loading = computed(() => isHydrated.value && status.value === 'pending')

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
</script>

<template>
  <ListPage
    id="repartidores"
    title="Repartidores"
    :loading="loading"
    :error="Boolean(error)"
    :error-message="message"
    @refresh="refresh()"
  >
    <template #actions>
      <AppCsvExportButton
        filename="repartidores"
        :columns="csvColumns"
        :rows="repartidores"
        :disabled="loading"
      />
    </template>
    <template #toolbar>
      <ListToolbar
        v-model:search="filter"
        placeholder="Buscar repartidor"
        :has-active-filters="Boolean(filter)"
        @clear="filter = ''"
      >
        <template #actions>
          <OrdersOrderRepartidorAddModal @created="addToCatalog" />
        </template>
      </ListToolbar>
    </template>
    <ListTable
      v-model:page="page"
      :page-size="pageSize"
      :data="repartidores"
      :columns="columns"
      :loading="loading"
      empty="No hay repartidores para mostrar."
      @select="openRepartidor"
    />
    <template #pagination>
      <ListPagination
        v-model:page="page"
        :label="'repartidores'"
        :total-results="repartidores.length"
        :page-size="pageSize"
        :loading="loading"
      />
    </template>
  </ListPage>
</template>
