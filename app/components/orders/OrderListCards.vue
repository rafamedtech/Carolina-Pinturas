<script setup lang="ts">
import { createCurrencyFormatter } from '@rafamedtech/nuxt-shared/utils'
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

const currency = createCurrencyFormatter('MXN')

function igualacionItems(order: SalesOrderListItem) {
  return (order.partidas ?? []).filter(item => item.isIgualacion)
}
</script>

<template>
  <div class="flex flex-col gap-3 md:hidden">
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
        :summary-label="igualacion ? 'Igualaciones' : 'Total'"
        :summary-value="currency.format(order.total)"
        :summary-stacked="igualacion"
        @select="emit('open', order)"
      >
        <template #trailing>
          <OrdersOrderStatusBadge :status="order.status" />
        </template>
        <template v-if="igualacion" #summary>
          <template v-if="!igualacionItems(order).length">
            —
          </template>
          <ul v-else class="space-y-1">
            <li
              v-for="(item, index) in igualacionItems(order)"
              :key="index"
              class="flex flex-col"
            >
              <span>{{ item.quantity }} x {{ item.code }}</span>
              <span v-if="item.observations" class="text-sm font-normal text-muted">{{ item.observations }}</span>
            </li>
          </ul>
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
