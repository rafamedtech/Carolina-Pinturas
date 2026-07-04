<script setup lang="ts">
import type { OrderStatus, SalesOrderDetail, SalesOrderStatusHistoryItem } from '~/types/orders'

const props = defineProps<{
  order: SalesOrderDetail
  statuses: OrderStatus[]
  saving: boolean
  entries: readonly SalesOrderStatusHistoryItem[]
  editable?: boolean
}>()

const statusKey = defineModel<string>('statusKey', { required: true })
const note = defineModel<string>('note', { required: true })

const statusOptions = computed(() => props.statuses.map(status => ({
  label: status.label,
  value: status.key
})))

const historyModalOpen = shallowRef(false)
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold text-highlighted">
        Seguimiento
      </h2>
    </template>

    <div class="space-y-4">
      <div v-if="editable" class="flex items-end gap-2">
        <UFormField label="Estado" class="flex-1">
          <USelect
            v-model="statusKey"
            :items="statusOptions"
            value-key="value"
            :disabled="saving"
            class="w-full"
          />
        </UFormField>

        <UPopover :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-sticky-note"
            color="neutral"
            variant="ghost"
            :aria-label="note ? 'Editar nota del cambio' : 'Agregar nota del cambio'"
          />
          <template #content>
            <UTextarea
              v-model="note"
              :rows="3"
              :disabled="saving"
              placeholder="Nota del cambio (opcional)"
              class="w-72 m-3"
              :ui="{ base: 'resize-none' }"
            />
          </template>
        </UPopover>
      </div>

      <div :class="{ 'border-t border-default pt-4': editable }">
        <div class="mb-3 flex items-center justify-between gap-2">
          <h3 class="text-sm font-medium text-muted">
            Historial de cambios
          </h3>
          <UButton
            label="Ver todos"
            color="neutral"
            variant="ghost"
            size="sm"
            class="hidden lg:flex"
            @click="historyModalOpen = true"
          />
        </div>

        <OrdersOrderHistoryList :entries="entries" :collapse-after="3" />
      </div>
    </div>

    <UModal v-model:open="historyModalOpen" title="Historial de cambios">
      <template #body>
        <OrdersOrderHistoryList :entries="entries" />
      </template>
    </UModal>
  </UCard>
</template>
