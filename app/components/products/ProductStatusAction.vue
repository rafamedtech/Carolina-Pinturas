<script setup lang="ts">
import type { SiigoProduct } from '~/types/siigo'

const props = defineProps<{ product: SiigoProduct, triggerClass?: string }>()
const emit = defineEmits<{ changed: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { saving, errorMessage, ambiguous, checking, lookupResults, save, check } = useProductMutation()
const label = computed(() => props.product.active === false ? 'Activar' : 'Desactivar')
async function confirm() {
  if (await save({ active: props.product.active === false }, props.product.id)) {
    open.value = false
    emit('changed')
  }
}
</script>

<template>
  <AppButton
    v-if="product.internal?.syncPending"
    :to="`/productos/${product.id}/editar`"
    label="Resolver guardado pendiente"
    :class="triggerClass"
    intent="secondary"
  />
  <UModal
    v-else
    v-model:open="open"
    :title="`${label} producto`"
    :description="`${product.code} · ${product.name}`"
  >
    <AppButton
      :label="label"
      :icon="product.active === false ? 'i-lucide-circle-check' : 'i-lucide-ban'"
      :class="triggerClass"
      class="cursor-pointer"
      intent="secondary"
      :color="product.active === false ? 'neutral' : 'error'"
      variant="subtle"
    />
    <template #body>
      <div class="space-y-4">
        <p>{{ product.active === false ? 'El producto volverá a estar disponible para pedidos nuevos.' : 'El producto dejará de estar disponible para pedidos nuevos. Los pedidos anteriores se conservan.' }}</p>
        <UAlert v-if="errorMessage" :title="errorMessage" color="error" />
        <template v-if="ambiguous">
          <AppButton :to="`/productos/${product.id}/editar`" label="Resolver guardado pendiente" />
          <AppButton label="Consultar resultado en Siigo" :loading="checking" @click="check(product.id)" />
          <p v-for="result in lookupResults" :key="result.id">
            Estado actual: {{ result.active ? 'Activo' : 'Inactivo' }}
          </p>
        </template>
        <div class="flex justify-end gap-3">
          <AppButton
            label="Cerrar"
            intent="secondary"
            :disabled="saving"
            @click="open = false"
          />
          <AppButton
            :label="label"
            :color="product.active === false ? 'primary' : 'error'"
            :disabled="ambiguous || saving"
            :loading="saving"
            @click="confirm"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
