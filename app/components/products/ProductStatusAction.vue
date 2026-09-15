<script setup lang="ts">
import type { SiigoProduct } from '~/types/siigo'

const props = defineProps<{ product: SiigoProduct }>()
const emit = defineEmits<{ changed: [] }>()
const open = shallowRef(false)
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
  <UModal v-model:open="open" :title="`${label} producto`" :description="`${product.code} · ${product.name}`">
    <UButton :label="label" color="neutral" variant="outline" />
    <template #body>
      <div class="space-y-4">
        <p>{{ product.active === false ? 'El producto volverá a estar disponible para pedidos nuevos.' : 'El producto dejará de estar disponible para pedidos nuevos. Los pedidos anteriores se conservan.' }}</p>
        <UAlert v-if="errorMessage" :title="errorMessage" color="error" />
        <template v-if="ambiguous">
          <UButton label="Consultar resultado en Siigo" :loading="checking" @click="check(product.id)" />
          <p v-for="result in lookupResults" :key="result.id">
            Estado actual: {{ result.active ? 'Activo' : 'Inactivo' }}
          </p>
        </template>
        <div class="flex justify-end gap-3">
          <UButton
            label="Cerrar"
            color="neutral"
            variant="outline"
            :disabled="saving"
            @click="open = false"
          />
          <UButton
            :label="label"
            :color="product.active === false ? 'primary' : 'warning'"
            :disabled="ambiguous || saving"
            :loading="saving"
            @click="confirm"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
