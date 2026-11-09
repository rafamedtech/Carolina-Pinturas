<script setup lang="ts">
import { formatDate } from '~/utils/datetime'
import type { SalesOrderListItem } from '~/types/orders'

withDefaults(defineProps<{
  orders: readonly SalesOrderListItem[]
  loading: boolean
  returnTo: string
  igualacion?: boolean
}>(), {
  igualacion: false
})

const emit = defineEmits<{
  open: [order: SalesOrderListItem]
}>()

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN'
})

function igualacionItems(order: SalesOrderListItem) {
  return (order.partidas ?? []).filter(item => item.isIgualacion)
}
</script>

<template>
  <div class="flex flex-col gap-3 md:hidden" :aria-busy="loading">
    <ListLoading v-if="loading" />

    <template v-else-if="orders.length">
      <ListRecordCard
        v-for="order in orders"
        :key="order.id"
        :title="order.number"
        :eyebrow="formatDate(order.orderDate)"
        :to="igualacion
          ? undefined
          : {
            path: `/ventas/${encodeURIComponent(order.id)}`,
            query: { returnTo }
          }"
        :actionable="igualacion"
        :aria-label="`${igualacion ? 'Ver' : 'Abrir'} pedido ${order.number} de ${order.customer.name}`"
        :fields="[{ label: 'Cliente', value: order.customer.name, fullWidth: true }]"
        :summary-label="igualacion ? undefined : 'Total'"
        :summary-value="currency.format(order.total)"
        @select="emit('open', order)"
      >
        <template #trailing>
          <OrdersOrderStatusBadge :status="order.status" />
        </template>
        <template v-if="igualacion" #summary>
          <dl class="border-t border-default pt-3 text-sm">
            <dt class="text-muted">
              Igualaciones
            </dt>
            <dd v-if="!igualacionItems(order).length" class="text-lg font-semibold text-highlighted">
              —
            </dd>
            <dd
              v-for="(item, index) in igualacionItems(order)"
              v-else
              :key="index"
              class="flex flex-col text-lg font-semibold text-highlighted"
            >
              <span>{{ item.quantity }} x {{ item.code }}</span>
              <span v-if="item.observations" class="text-sm font-normal text-muted">{{ item.observations }}</span>
            </dd>
          </dl>
        </template>
      </ListRecordCard>
    </template>

    <div
      v-else
      class="flex flex-col items-center gap-2 rounded-lg border border-default bg-elevated/50 px-4 py-10 text-center"
    >
      <UIcon name="i-lucide-package-open" class="size-8 text-muted" />
      <p class="text-sm text-muted">
        No hay pedidos para mostrar.
      </p>
    </div>
  </div>
</template>
