<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui'
import type { RepartidorDelivery, RepartidorDetail } from '~/types/orders'

const route = useRoute()
const router = useRouter()
const repartidorId = computed(() => String(route.params.id))
const { data: repartidor, status, error, refresh } = useLazyFetch<RepartidorDetail>(
  () => `/api/repartidores/${encodeURIComponent(repartidorId.value)}`,
  { key: () => `repartidor-${repartidorId.value}` }
)

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const message = computed(() => error.value?.data?.statusMessage || 'No fue posible cargar el repartidor.')

useSeoMeta({ title: () => repartidor.value?.nombre || 'Detalle del repartidor' })

function formatDate(value: string) {
  return value.split('-').reverse().join('/')
}

const columns: TableColumn<RepartidorDelivery>[] = [{
  accessorKey: 'number',
  header: 'Pedido'
}, {
  id: 'customerName',
  header: 'Cliente',
  cell: ({ row }) => row.original.customerName
}, {
  id: 'orderDate',
  header: 'Fecha',
  cell: ({ row }) => formatDate(row.original.orderDate)
}, {
  id: 'total',
  header: 'Total',
  cell: ({ row }) => currency.format(row.original.total)
}]

function openOrder(_: Event, row: TableRow<RepartidorDelivery>) {
  router.push(`/ventas/${encodeURIComponent(row.original.id)}`)
}
</script>

<template>
  <UDashboardPanel id="repartidor-detail">
    <template #header>
      <UDashboardNavbar :title="repartidor?.nombre || 'Detalle del repartidor'">
        <template #leading>
          <UButton
            to="/repartidores"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            aria-label="Volver a repartidores"
          />
        </template>
        <template #right>
          <UButton
            label="Actualizar"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :loading="status === 'pending'"
            @click="() => refresh()"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="error"
        color="warning"
        variant="subtle"
        title="Repartidor no disponible"
        :description="message"
        icon="i-lucide-plug-zap"
      />

      <template v-else-if="repartidor">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-sm text-muted">
              Repartidor
            </p>
            <h1 class="text-xl font-semibold text-highlighted">
              {{ repartidor.nombre }}
            </h1>
            <p class="mt-1 text-sm text-muted">
              {{ repartidor.telefono || '—' }}
            </p>
          </div>
          <UBadge :color="repartidor.activo === false ? 'neutral' : 'success'" variant="subtle" size="lg">
            {{ repartidor.activo === false ? 'Inactivo' : 'Activo' }}
          </UBadge>
        </div>

        <UCard>
          <template #header>
            <h2 class="font-semibold text-highlighted">
              Pedidos entregados ({{ repartidor.deliveredOrders.length }})
            </h2>
          </template>

          <UTable
            :data="repartidor.deliveredOrders"
            :columns="columns"
            empty="Este repartidor aún no tiene pedidos entregados."
            class="shrink-0"
            :meta="{ class: { tr: 'cursor-pointer transition-colors hover:bg-elevated/50' } }"
            @select="openOrder"
          />
        </UCard>
      </template>

      <template v-else-if="status === 'pending'">
        <div class="flex flex-wrap items-start justify-between gap-4" role="status" aria-busy="true">
          <div class="flex flex-col gap-2">
            <USkeleton class="h-4 w-24" />
            <USkeleton class="h-7 w-48" />
            <USkeleton class="h-4 w-28" />
          </div>
          <USkeleton class="h-8 w-24 rounded-full" />
        </div>
        <AppTableSkeleton :rows="5" :cols="columns.length" />
        <span class="sr-only">Cargando repartidor…</span>
      </template>
    </template>
  </UDashboardPanel>
</template>
