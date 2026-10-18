<script setup lang="ts">
import type { ListLayoutConfig } from '~/types/list'
import { tableReturnPath } from '~/utils/tableQuery'
import { formatDate } from '~/utils/datetime'
import type { TableColumn, TableRow } from '@nuxt/ui'
import type { RepartidorDelivery, RepartidorDetail } from '~/types/orders'

const route = useRoute()
const router = useRouter()
const backPath = computed(() => tableReturnPath(route.query.returnTo, '/repartidores'))
const repartidorId = computed(() => String(route.params.id))
const { data: repartidor, status, error, refresh } = useLazyFetch<RepartidorDetail>(
  () => `/api/repartidores/${encodeURIComponent(repartidorId.value)}`,
  { key: () => `repartidor-${repartidorId.value}` }
)

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const message = computed(() => error.value?.data?.statusMessage || 'No fue posible cargar el repartidor.')

useSeoMeta({ title: () => repartidor.value?.nombre || 'Detalle del repartidor' })

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
  router.push({ path: `/ventas/${encodeURIComponent(row.original.id)}`, query: { returnTo: route.fullPath } })
}
const deliveryPage = shallowRef(1)
const deliveryConfig: ListLayoutConfig = { id: 'driver-deliveries', title: 'Pedidos entregados', empty: 'Este repartidor aún no tiene pedidos entregados.', pagination: { mode: 'client', label: 'pedidos', pageSize: 25 } }
</script>

<template>
  <UDashboardPanel id="repartidor-detail">
    <template #header>
      <UDashboardNavbar :title="repartidor?.nombre || 'Detalle del repartidor'">
        <template #leading>
          <UButton
            :to="backPath"
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

        <ListLayout
          v-model:page="deliveryPage"
          :config="deliveryConfig"
          :data="repartidor.deliveredOrders"
          :columns="columns"
          :loading="status === 'pending'"
          embedded
          @select="openOrder"
          @refresh="refresh()"
        />
      </template>

      <ListLoading v-else-if="status === 'pending'" />
    </template>
  </UDashboardPanel>
</template>
