<script setup lang="ts">
import type { SalesOrderListItem } from '~/types/orders'

defineProps<{ order: SalesOrderListItem | null, returnTo: string }>()
const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <UModal
    v-model:open="open"
    :title="order ? `Pedido ${order.number}` : 'Pedido'"
  >
    <template #body>
      <div v-if="order" class="flex flex-col gap-4">
        <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div class="flex flex-col">
            <dt class="text-muted">
              Fecha
            </dt>
            <dd>{{ formatDate(order.orderDate) }}</dd>
          </div>
          <div class="flex flex-col">
            <dt class="text-muted">
              Estado
            </dt>
            <dd>
              <OrdersOrderStatusBadge :status="order.status" />
            </dd>
          </div>
          <div class="col-span-2 flex flex-col">
            <dt class="text-muted">
              Cliente
            </dt>
            <dd>{{ order.customer.name }}</dd>
          </div>
        </dl>

        <div class="flex flex-col gap-2">
          <h3 class="text-sm font-medium">
            Partidas
          </h3>
          <ul class="flex flex-col gap-1">
            <li
              v-for="(item, index) in order.partidas ?? []"
              :key="index"
              class="flex flex-col rounded-md border px-3 py-2 text-sm"
              :class="item.isIgualacion
                ? 'border-primary bg-primary/10'
                : 'border-default'"
            >
              <div class="flex items-center gap-2">
                <UBadge
                  v-if="item.isIgualacion"
                  color="primary"
                  variant="solid"
                  size="sm"
                  label="Igualación"
                />
                <span class="font-medium">{{ item.quantity }} x {{ item.code }}</span>
              </div>
              <span class="text-muted">{{ item.name }}</span>
              <span v-if="item.observations" class="text-muted">{{ item.observations }}</span>
            </li>
            <li v-if="!(order.partidas ?? []).length" class="text-sm text-muted">
              Sin partidas.
            </li>
          </ul>
        </div>
      </div>
    </template>
    <template #footer>
      <UButton
        v-if="order"
        :to="{
          path: `/ventas/${encodeURIComponent(order.id)}`,
          query: { returnTo }
        }"
        label="Atender pedido"
        icon="i-lucide-arrow-right"
        trailing
        @click="open = false"
      />
    </template>
  </UModal>
</template>
