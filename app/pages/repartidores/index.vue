<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui'
import type { Repartidor } from '~/types/orders'

useSeoMeta({ title: 'Repartidores' })

const filter = ref('')
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
  router.push(`/repartidores/${encodeURIComponent(row.original.id)}`)
}
</script>

<template>
  <UDashboardPanel id="repartidores">
    <template #header>
      <UDashboardNavbar title="Repartidores">
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
          placeholder="Buscar repartidor"
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
          <OrdersOrderRepartidorAddModal @created="addToCatalog" />
        </div>
      </div>

      <UAlert
        v-if="error"
        color="warning"
        variant="subtle"
        title="Repartidores no disponibles"
        :description="message"
        icon="i-lucide-plug-zap"
      />

      <AppTableSkeleton v-else-if="loading" :cols="columns.length" />

      <UTable
        v-else
        :data="repartidores"
        :columns="columns"
        empty="No hay repartidores para mostrar."
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
        @select="openRepartidor"
      />
    </template>
  </UDashboardPanel>
</template>
