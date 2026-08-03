<script setup lang="ts">
type FilterOption = {
  label: string
  value: string
}

const props = defineProps<{
  paymentStatus: string
  paymentMethod: string
  hideCancelled: boolean
  hideQuotes: boolean
  paymentStatusOptions: FilterOption[]
  paymentMethodOptions: FilterOption[]
}>()

const emit = defineEmits<{
  apply: [filters: {
    paymentStatus: string
    paymentMethod: string
    hideCancelled: boolean
    hideQuotes: boolean
  }]
}>()

const open = defineModel<boolean>('open', { required: true })
const filters = reactive({
  paymentStatus: props.paymentStatus,
  paymentMethod: props.paymentMethod,
  hideCancelled: props.hideCancelled,
  hideQuotes: props.hideQuotes
})

watch(open, (isOpen) => {
  if (!isOpen) return

  Object.assign(filters, {
    paymentStatus: props.paymentStatus,
    paymentMethod: props.paymentMethod,
    hideCancelled: props.hideCancelled,
    hideQuotes: props.hideQuotes
  })
})

function applyFilters() {
  emit('apply', { ...filters })
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Más filtros"
    description="Refina los pedidos que quieres consultar."
    :close="false"
    :ui="{ footer: 'justify-end' }"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField name="payment-status" label="Estado de pago">
          <USelect
            v-model="filters.paymentStatus"
            :items="paymentStatusOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField name="payment-method" label="Método de pago">
          <USelect
            v-model="filters.paymentMethod"
            :items="paymentMethodOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField name="hide-cancelled">
          <UCheckbox v-model="filters.hideCancelled" label="Ocultar cancelados" />
        </UFormField>

        <UFormField name="hide-quotes">
          <UCheckbox v-model="filters.hideQuotes" label="Ocultar cotizaciones" />
        </UFormField>
      </div>
    </template>

    <template #footer="{ close }">
      <UButton
        label="Cancelar"
        color="neutral"
        variant="outline"
        @click="close"
      />
      <UButton label="Aplicar filtros" icon="i-lucide-check" @click="applyFilters" />
    </template>
  </UModal>
</template>
