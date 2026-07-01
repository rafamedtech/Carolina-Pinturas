<script setup lang="ts">
import type { OrderStatus, SalesOrderDetail } from '~/types/orders'

const props = defineProps<{
  order: SalesOrderDetail
  statuses: OrderStatus[]
  saving: boolean
}>()

const emit = defineEmits<{
  update: []
}>()

const statusKey = defineModel<string>('statusKey', { required: true })
const note = defineModel<string>('note', { required: true })

const statusOptions = computed(() => props.statuses.map(status => ({
  label: status.label,
  value: status.key
})))
const unchanged = computed(() => statusKey.value === props.order.status.key)
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold text-highlighted">
        Seguimiento
      </h2>
    </template>

    <div class="space-y-4">
      <UFormField label="Estado">
        <USelect
          v-model="statusKey"
          :items="statusOptions"
          value-key="value"
          :disabled="saving"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Nota del cambio">
        <UTextarea
          v-model="note"
          :rows="3"
          :disabled="saving"
          placeholder="Opcional"
          class="w-full"
        />
      </UFormField>

      <UButton
        label="Actualizar estado"
        icon="i-lucide-refresh-cw"
        :loading="saving"
        :disabled="saving || unchanged"
        @click="emit('update')"
      />
    </div>
  </UCard>
</template>
