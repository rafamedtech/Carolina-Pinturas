<script setup lang="ts">
import type { SalesOrderListItem } from '~/types/orders'

defineProps<{
  orders: readonly SalesOrderListItem[]
  loading: boolean
}>()

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN'
})

function formatDate(value: string | null) {
  if (!value) return '—'
  return value.split('-').reverse().join('/')
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
        :ui="{ body: 'flex flex-col gap-4 p-4 sm:p-4' }"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-medium uppercase tracking-wide text-muted">
              Pedido
            </p>
            <NuxtLink
              :to="`/ventas/${encodeURIComponent(order.id)}`"
              class="text-lg font-semibold text-primary hover:underline"
              :aria-label="`Abrir pedido ${order.number}`"
            >
              {{ order.number }}
            </NuxtLink>
          </div>
          <OrdersOrderStatusBadge :status="order.status" />
        </div>

        <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div class="col-span-2">
            <dt class="text-muted">
              Cliente
            </dt>
            <dd class="font-medium text-highlighted">
              {{ order.customer.name }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Fecha
            </dt>
            <dd class="text-highlighted">
              {{ formatDate(order.orderDate) }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Partidas
            </dt>
            <dd class="text-highlighted">
              {{ order.itemCount }}
            </dd>
          </div>
          <div class="col-span-2 flex items-end justify-between gap-4 border-t border-default pt-3">
            <dt class="text-muted">
              Total
            </dt>
            <dd class="text-base font-semibold text-highlighted">
              {{ currency.format(order.total) }}
            </dd>
          </div>
        </dl>

        <UButton
          :to="`/ventas/${encodeURIComponent(order.id)}`"
          label="Ver pedido"
          icon="i-lucide-arrow-right"
          trailing
          block
          variant="soft"
        />
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
