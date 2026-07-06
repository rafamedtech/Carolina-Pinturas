<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui'
import type { SiigoCustomer } from '~/types/siigo'

useSeoMeta({ title: 'Clientes' })

const filter = ref('')
const router = useRouter()
const { data, status, error, refresh } = useCustomersCatalog()

const isHydrated = shallowRef(false)
onMounted(() => {
  isHydrated.value = true
})
const loading = computed(() => isHydrated.value && status.value === 'pending')

const customers = computed(() => {
  const value = filter.value.trim().toLowerCase()
  const records = data.value?.results || []
  if (!value) return records

  return records.filter((customer) => {
    const name = customer.name?.filter(Boolean).join(' ') || ''
    const email = customer.contacts?.[0]?.email || ''
    return `${customer.rfc_id || ''} ${name} ${email}`.toLowerCase().includes(value)
  })
})

const columns: TableColumn<SiigoCustomer>[] = [{
  accessorKey: 'rfc_id',
  header: 'RFC',
  cell: ({ row }) => row.getValue('rfc_id') || '—'
}, {
  id: 'name',
  header: 'Cliente',
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
}]

const message = computed(() => error.value?.data?.statusMessage || 'No fue posible cargar los clientes.')

function openCustomer(_: Event, row: TableRow<SiigoCustomer>) {
  router.push(`/clientes/${encodeURIComponent(row.original.id)}`)
}
</script>

<template>
  <UDashboardPanel id="customers">
    <template #header>
      <UDashboardNavbar title="Clientes">
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
          placeholder="Buscar cliente"
          class="w-full sm:max-w-sm"
        />
        <div class="flex gap-2">
          <UButton
            label="Actualizar"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :loading="loading"
            @click="() => refresh()"
          />
          <UButton
            label="Nuevo cliente"
            icon="i-lucide-user-plus"
            disabled
            title="Se habilita tras validar la API de Siigo México."
          />
        </div>
      </div>

      <UAlert
        v-if="error"
        color="warning"
        variant="subtle"
        title="Clientes no disponibles"
        :description="message"
        icon="i-lucide-plug-zap"
      />

      <AppTableSkeleton v-else-if="loading" :cols="columns.length" />

      <UTable
        v-else
        :data="customers"
        :columns="columns"
        empty="No hay clientes para mostrar."
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
        @select="openCustomer"
      />
    </template>
  </UDashboardPanel>
</template>
