<script setup lang="ts">
import type { SiigoProduct } from '~/types/siigo'
import type { ProductContext, ProductInput } from '~/types/siigo-products'
import { productInputSchema } from '#shared/schemas/product'
import { productDuplicateInput, productMutationInput } from '~/utils/siigoProductMutation'

const props = defineProps<{ product?: SiigoProduct, duplicate?: boolean, context: ProductContext, saving: boolean, blocked: boolean, draft?: ProductInput, confirmedVersion?: number }>()
const emit = defineEmits<{ submit: [input: ProductInput], cancel: [] }>()
const state = ref(props.duplicate && props.product ? productDuplicateInput(props.product) : productMutationInput(props.product))
watch(() => props.draft, (input) => {
  if (input) state.value = productInputSchema.parse(input)
})
watch(() => props.confirmedVersion, (version) => {
  if (version) state.value.composition.version = version
})
const formState = computed(() => ({
  ...state.value,
  active: state.value.availability.purchase || state.value.availability.sale || state.value.availability.expense
}))
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
    :state="formState"
    class="space-y-5"
    @submit="emit('submit', $event.data)"
  >
    <fieldset :disabled="saving" class="space-y-5">
      <ProductsProductGeneralFields
        v-model="state"
        :context="context"
        hide-secondary-fields
      />
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ProductsProductAvailabilityFields v-model="state.availability" class="min-w-0" />
        <ProductsProductCompositionFields v-model="state" :product-id="duplicate ? undefined : product?.id" class="min-w-0" />
      </div>
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
          :label="product && !duplicate ? 'Guardar cambios' : 'Crear producto'"
          :loading="saving"
          :disabled="blocked || saving"
        />
      </div>
    </fieldset>
  </UForm>
</template>
