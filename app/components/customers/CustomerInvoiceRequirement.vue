<script setup lang="ts">
const props = defineProps<{
  requiresInvoice: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  save: [requiresInvoice: boolean]
}>()

const selected = shallowRef(props.requiresInvoice)

watch(() => props.requiresInvoice, (value) => {
  selected.value = value
})

const changed = computed(() => selected.value !== props.requiresInvoice)
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <USwitch v-model="selected" label="Requiere factura" :disabled="saving" />
    <UButton
      label="Guardar facturación"
      icon="i-lucide-save"
      size="sm"
      variant="outline"
      :loading="saving"
      :disabled="!changed || saving"
      @click="emit('save', selected)"
    />
  </div>
</template>
