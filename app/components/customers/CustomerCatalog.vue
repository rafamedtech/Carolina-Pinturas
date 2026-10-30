<script setup lang="ts">
import type { ListLayoutConfig } from '~/types/list'
import { tableQueryField, tableQueryText, tableQueryPage } from '~/utils/tableQuery'
import type { TableColumn, TableRow } from '@nuxt/ui'
import type { SiigoCustomer } from '~/types/siigo'
import type { CsvColumn } from '~/utils/csv'
import { customerCatalogTabs, customerCatalogRoles, customerCatalogRoleLabel, filterCustomerCatalog } from '~/utils/customerCatalog'

const filter = shallowRef('')
const view = shallowRef('all')
const page = shallowRef(1)
const pageSize = 25
const { returnTo } = useTableQuery([
  tableQueryField('search', filter, tableQueryText()),
  tableQueryField('view', view, tableQueryText('all', customerCatalogTabs.map(tab => tab.value))),
  tableQueryField('page', page, tableQueryPage)
], { page, resetOn: [filter, view] })
const router = useRouter()
const toast = useToast()
const {
  data,
  status,
  error,
  refreshing,
  refresh
} = useCustomersCatalog()

const loading = computed(() => ['idle', 'pending'].includes(status.value))
const records = computed(() => filterCustomerCatalog(data.value?.results || [], view.value, filter.value))

const csvColumns: CsvColumn<SiigoCustomer>[] = [
  { key: 'rfc_id', label: 'RFC', value: row => row.rfc_id || '' },
  { key: 'name', label: 'Nombre', value: row => row.name?.filter(Boolean).join(' ') || '' },
  { key: 'role', label: 'Tipo', value: customerCatalogRoleLabel },
  { key: 'requires_invoice', label: 'Requiere factura', value: row => row.internal?.requires_invoice === true ? 'Sí' : 'No' },
  { key: 'email', label: 'Correo', value: row => row.contacts?.[0]?.email || '' },
  { key: 'phone', label: 'Teléfono', value: row => row.phones?.map(phone => phone.number).filter(Boolean).join(', ') || '' },
  { key: 'active', label: 'Estado', value: row => row.active === false ? 'Inactivo' : 'Activo' }
]

const columns = computed<TableColumn<SiigoCustomer>[]>(() => [{
  accessorKey: 'rfc_id',
  header: 'RFC',
  cell: ({ row }) => row.getValue('rfc_id') || '—'
}, {
  id: 'name',
  header: 'Nombre',
  cell: ({ row }) => row.original.name?.filter(Boolean).join(' ') || '—'
}, {
  id: 'role',
  header: 'Tipo',
  cell: ({ row }) => customerCatalogRoleLabel(row.original)
}, {
  id: 'requires_invoice',
  header: 'Requiere factura',
  cell: ({ row }) => row.original.internal?.requires_invoice === true ? 'Sí' : 'No'
}, {
  id: 'email',
  header: 'Correo',
  cell: ({ row }) => row.original.contacts?.[0]?.email || '—'
}, {
  id: 'phone',
  header: 'Teléfono',
  cell: ({ row }) => row.original.phones?.map(phone => phone.number).filter(Boolean).join(', ') || '—'
}, {
  accessorKey: 'active',
  header: 'Estado',
  cell: ({ row }) => row.getValue('active') === false ? 'Inactivo' : 'Activo'
}])

const message = computed(() =>
  error.value?.data?.statusMessage || 'No fue posible cargar los clientes y proveedores.'
)

function openRecord(_: Event, row: TableRow<SiigoCustomer>) {
  const roles = customerCatalogRoles(row.original)
  const routeBase = view.value === 'proveedores' || (!roles.customer && roles.supplier) ? '/proveedores' : '/clientes'
  router.push({ path: `${routeBase}/${encodeURIComponent(row.original.id)}`, query: { returnTo: returnTo.value } })
}

async function reloadRecords() {
  try {
    await refresh()
    toast.add({
      title: 'Clientes y proveedores actualizados',
      description: 'La información se volvió a consultar directamente en Siigo.',
      color: 'success'
    })
  } catch (refreshError: unknown) {
    toast.add({
      title: 'No se pudo consultar Siigo',
      description: (refreshError as { data?: { statusMessage?: string } }).data?.statusMessage
        || 'Intenta nuevamente.',
      color: 'error'
    })
  }
}
const listConfig: ListLayoutConfig = {
  id: 'customers',
  title: 'Clientes y proveedores',
  empty: 'No hay registros que coincidan con esta vista y búsqueda.',
  search: { placeholder: 'Buscar por nombre, RFC o correo' },
  tabs: customerCatalogTabs,
  create: { label: 'Nuevo registro', icon: 'i-lucide-user-plus', disabled: true, reason: 'Se habilita tras validar la API de Siigo México.' },
  pagination: { mode: 'client', label: 'registros', pageSize }
}
</script>

<template>
  <ListLayout
    v-model:search="filter"
    v-model:page="page"
    v-model:tab="view"
    :config="listConfig"
    :data="records"
    :columns="columns"
    :loading="loading || refreshing"
    :error="Boolean(error)"
    :error-message="message"
    @refresh="reloadRecords"
    @select="openRecord"
  >
    <template #actions>
      <AppCsvExportButton
        :filename="view === 'all' ? 'clientes-y-proveedores' : view"
        :columns="csvColumns"
        :rows="records"
        :disabled="loading"
      />
    </template>
  </ListLayout>
</template>
