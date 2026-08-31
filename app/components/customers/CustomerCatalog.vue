<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui'
import type { SiigoCustomer } from '~/types/siigo'

const props = withDefaults(defineProps<{
  title: string
  singularLabel: string
  routeBase: '/clientes' | '/proveedores'
  customerType?: 'Supplier'
}>(), {
  customerType: undefined
})

const filter = shallowRef('')
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
  router.push(`${props.routeBase}/${encodeURIComponent(row.original.id)}`)
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
  <UDashboardPanel :id="routeBase === '/proveedores' ? 'suppliers' : 'customers'">
    <template #header>
      <UDashboardNavbar :title="title">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <UInput
          v-model="filter"
          icon="i-lucide-search"
          :placeholder="`Buscar ${singularLower}`"
          class="w-full sm:max-w-sm"
        />
        <div class="flex gap-2">
          <UButton
            label="Recargar"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :loading="loading || refreshing"
            @click="reloadRecords"
          />
          <UButton
            :label="`Nuevo ${singularLower}`"
            :icon="routeBase === '/proveedores' ? 'i-lucide-building-2' : 'i-lucide-user-plus'"
            disabled
            title="Se habilita tras validar la API de Siigo México."
          />
        </div>
      </div>

      <UAlert
        v-if="error"
        color="warning"
        variant="subtle"
        :title="`${title} no disponibles`"
        :description="message"
        icon="i-lucide-plug-zap"
      />

      <AppTableSkeleton v-else-if="loading" :cols="columns.length" />

      <UTable
        v-else
        :data="records"
        :columns="columns"
        :empty="`No hay ${pluralLower} para mostrar.`"
        class="shrink-0"
        :meta="{ class: { tr: 'cursor-pointer transition-colors hover:bg-elevated/50' } }"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
          separator: 'h-0'
        }"
        @select="openRecord"
      />
    </template>
  </UDashboardPanel>
</template>
