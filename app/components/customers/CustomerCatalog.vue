<script setup lang="ts">
import { tableQueryField, tableQueryText, tableQueryPage } from '~/utils/tableQuery'
import type { TableColumn, TableRow } from '@nuxt/ui'
import type { SiigoCustomer } from '~/types/siigo'
import type { CsvColumn } from '~/utils/csv'

const props = withDefaults(defineProps<{
  title: string
  singularLabel: string
  routeBase: '/clientes' | '/proveedores'
  customerType?: 'Customer' | 'Supplier'
}>(), {
  customerType: undefined
})

const filter = shallowRef('')
const page = shallowRef(1)
const pageSize = 25
const { returnTo } = useTableQuery([
  tableQueryField('search', filter, tableQueryText()),
  tableQueryField('page', page, tableQueryPage)
], { page, resetOn: [filter] })
const router = useRouter()
const toast = useToast()
const {
  data,
  status,
  error,
  refreshing,
  refresh
} = useCustomersCatalog({ customerType: props.customerType })

const singularLower = computed(() => props.singularLabel.toLowerCase())
const pluralLower = computed(() => props.title.toLowerCase())
const loading = computed(() => status.value === 'pending')
const records = computed(() => {
  const value = filter.value.trim().toLowerCase()
  const customers = data.value?.results || []
  if (!value) return customers

  return customers.filter((customer) => {
    const name = customer.name?.filter(Boolean).join(' ') || ''
    const email = customer.contacts?.[0]?.email || ''
    return `${customer.rfc_id || ''} ${name} ${email}`.toLowerCase().includes(value)
  })
})

const csvColumns: CsvColumn<SiigoCustomer>[] = [
  { key: 'rfc_id', label: 'RFC', value: row => row.rfc_id || '' },
  { key: 'name', label: props.singularLabel, value: row => row.name?.filter(Boolean).join(' ') || '' },
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
  header: props.singularLabel,
  cell: ({ row }) => row.original.name?.filter(Boolean).join(' ') || '—'
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
  error.value?.data?.statusMessage || `No fue posible cargar los ${pluralLower.value}.`
)

function openRecord(_: Event, row: TableRow<SiigoCustomer>) {
  router.push({ path: `${props.routeBase}/${encodeURIComponent(row.original.id)}`, query: { returnTo: returnTo.value } })
}

async function reloadRecords() {
  try {
    await refresh()
    toast.add({
      title: `${props.title} actualizados`,
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
</script>

<template>
  <ListPage
    :id="routeBase === '/proveedores' ? 'suppliers' : 'customers'"
    :title="title"
    :loading="loading || refreshing"
    :error="Boolean(error)"
    :error-message="message"
    @refresh="reloadRecords"
  >
    <template #actions>
      <AppCsvExportButton
        :filename="routeBase === '/proveedores' ? 'proveedores' : 'clientes'"
        :columns="csvColumns"
        :rows="records"
        :disabled="loading"
      />
    </template>
    <template #toolbar>
      <ListToolbar
        v-model:search="filter"
        :placeholder="`Buscar ${singularLower}`"
        :has-active-filters="Boolean(filter)"
        @clear="filter = ''"
      >
        <template #actions>
          <UButton
            :label="`Nuevo ${singularLower}`"
            :icon="routeBase === '/proveedores' ? 'i-lucide-building-2' : 'i-lucide-user-plus'"
            disabled
            title="Se habilita tras validar la API de Siigo México."
            class="w-full justify-center sm:w-auto"
          />
        </template>
      </ListToolbar>
    </template>
    <ListTable
      v-model:page="page"
      :page-size="pageSize"
      :data="records"
      :columns="columns"
      :loading="loading"
      :empty="`No hay ${pluralLower} para mostrar.`"
      @select="openRecord"
    />
    <template #pagination>
      <ListPagination
        v-model:page="page"
        :label="pluralLower"
        :total-results="records.length"
        :page-size="pageSize"
        :loading="loading"
      />
    </template>
  </ListPage>
</template>
