<script setup lang="ts">
import type { SiigoProduct } from '~/types/siigo'
import type { ProductContext, ProductInput } from '~/types/siigo-products'
import { productInputSchema } from '#shared/schemas/product'
import { productMutationInput } from '~/utils/siigoProductMutation'

const props = defineProps<{ product?: SiigoProduct, context: ProductContext, saving: boolean, blocked: boolean }>()
const emit = defineEmits<{ submit: [input: ProductInput], cancel: [] }>()
const state = ref(productMutationInput(props.product))
const form = useTemplateRef('form')
for (const field of ['unit', 'key'] as const) {
  watch(() => state.value[field], async () => {
    await nextTick()
    await form.value?.validate({ name: field, silent: true })
  })
}
</script>

<template>
  <UForm
    ref="form"
    :schema="productInputSchema"
    :state="state"
    class="space-y-5"
    @submit="emit('submit', $event.data)"
  >
    <fieldset :disabled="saving" class="space-y-5">
      <ProductsProductGeneralFields v-model="state" :context="context" />
      <ProductsProductPriceFields v-model="state" :context="context" />
      <div class="flex flex-wrap justify-end gap-3">
        <UButton
          label="Cancelar"
          variant="outline"
          color="neutral"
          @click="emit('cancel')"
        />
        <UButton
          type="submit"
          :label="product ? 'Guardar cambios' : 'Crear producto'"
          :loading="saving"
          :disabled="blocked || saving"
        />
      </div>
    </fieldset>
  </UForm>
</template>
