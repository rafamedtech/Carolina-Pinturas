<script setup lang="ts">
import { resolveComponent } from 'vue'
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

const NuxtLink = resolveComponent('NuxtLink')
const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN'
})

function formatDate(value: string | null) {
  if (!value) return '—'
  return value.split('-').reverse().join('/')
}

function igualacionItems(order: SalesOrderListItem) {
  return (order.partidas ?? []).filter(item => item.isIgualacion)
}
</script>

<template>
  <div class="flex flex-col gap-3 md:hidden" :aria-busy="loading">
    <template v-if="loading">
      <UCard
        v-for="index in 3"
        :key="index"
        :ui="{ body: 'flex flex-col gap-4 p-4 sm:p-4' }"
      >
        <div class="flex items-center justify-between gap-4">
          <USkeleton class="h-5 w-24" />
          <USkeleton class="h-5 w-20" />
        </div>
        <USkeleton class="h-4 w-full" />
        <div class="grid grid-cols-2 gap-4">
          <USkeleton class="h-10 w-full" />
          <USkeleton class="h-10 w-full" />
        </div>
      </UCard>
      <span class="sr-only" role="status">Cargando pedidos…</span>
    </template>

    <template v-else-if="orders.length">
      <UCard
        v-for="order in orders"
        :key="order.id"
        :as="igualacion ? 'button' : NuxtLink"
        :to="igualacion
          ? undefined
          : {
            path: `/ventas/${encodeURIComponent(order.id)}`,
            query: { returnTo }
          }"
        :type="igualacion ? 'button' : undefined"
        :aria-label="`${igualacion ? 'Ver' : 'Abrir'} pedido ${order.number} de ${order.customer.name}`"
        class="block w-full cursor-pointer text-left transition-[transform,background-color,box-shadow] duration-150 ease-out hover:bg-elevated/50 active:scale-[0.985] active:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
        :ui="{ body: 'flex flex-col gap-4 p-4 sm:p-4' }"
        @click="igualacion && emit('open', order)"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-medium text-muted">
              {{ formatDate(order.orderDate) }}
            </p>
            <p class="text-lg font-semibold text-primary">
              {{ order.number }}
            </p>
          </div>
          <OrdersOrderStatusBadge :status="order.status" />
        </div>

        <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div class="col-span-2 min-w-0">
            <dt class="text-muted">
              Cliente
            </dt>
            <dd class="break-words font-medium text-highlighted">
              {{ order.customer.name }}
            </dd>
          </div>
          <div v-if="!igualacion" class="col-span-2 flex items-end justify-between gap-4 border-t border-default pt-3">
            <dt class="text-muted">
              Total
            </dt>
            <dd class="text-base font-semibold text-highlighted">
              {{ currency.format(order.total) }}
            </dd>
          </div>
          <div v-else class="col-span-2 flex flex-col gap-1 border-t border-default pt-3">
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
          </div>
        </dl>
      </UCard>
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
