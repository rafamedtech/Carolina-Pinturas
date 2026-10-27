<script setup lang="ts">
import type { ProductInput } from '~/types/siigo-products'
import type { InventoryProduct } from '#shared/types/inventory'
import { fetchAllPages } from '~/composables/useCsvExport'

const props = defineProps<{ productId?: string }>()
const model = defineModel<ProductInput>({ required: true })
const selected = ref('')
const requestFetch = useRequestFetch()
const { data, status, error, refresh } = useAsyncData('product-composition-candidates', () => fetchAllPages<InventoryProduct>('/api/inventory/products', { controlledOnly: 'true' }, 100, requestFetch), { server: false, lazy: true })
const candidates = computed(() => (data.value ?? []).filter(p => p.id !== props.productId && !model.value.composition.components.some(c => c.productId === p.id)))
const byId = computed(() => new Map((data.value ?? []).map(p => [p.id, p])))
const kind = computed({
  get: () => model.value.composition.kind,
  set: (value: 'product' | 'composite') => {
    model.value.composition.kind = value
    if (value === 'product') model.value.composition.components = []
  }
})
function add() {
  if (!candidates.value.some(p => p.id === selected.value)) return
  model.value.composition.components.push({ productId: selected.value, quantity: '1' })
  selected.value = ''
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">
        Composición e inventario
      </h2>
    </template>
    <div class="space-y-4">
      <UFormField label="Tipo de producto" name="composition.kind" required>
        <USelect v-model="kind" :items="[{ label: 'Producto', value: 'product' }, { label: 'Producto compuesto', value: 'composite' }]" class="w-full sm:max-w-sm" />
      </UFormField>
      <template v-if="kind === 'composite'">
        <UAlert v-if="error" title="No se pudieron cargar los componentes." color="error">
          <template #actions>
            <UButton label="Reintentar" variant="outline" @click="refresh()" />
          </template>
        </UAlert>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
          <UFormField label="Producto simple" class="min-w-0 flex-1">
            <ProductsProductSearch
              v-model="selected"
              :products="candidates"
              :loading="status === 'pending'"
              :disabled="status === 'pending' || Boolean(error)"
              aria-label="Componente"
            />
          </UFormField>
          <UButton
            label="Agregar componente"
            icon="i-lucide-plus"
            :disabled="!selected || Boolean(error)"
            @click="add"
          />
        </div>
        <UFormField name="composition.components" class="w-full">
          <p v-if="!model.composition.components.length" class="text-sm text-muted">
            Agrega al menos un producto simple con control de inventario interno.
          </p>
          <div v-else class="divide-y divide-default">
            <div v-for="(component, index) in model.composition.components" :key="component.productId" class="grid grid-cols-[1fr_auto] gap-3 py-3 sm:grid-cols-[1fr_11rem_auto] sm:items-center">
              <div class="min-w-0">
                <p class="break-words font-medium">
                  {{ byId.get(component.productId)?.name ?? component.productId }}
                </p>
                <p class="text-xs text-muted">
                  {{ byId.get(component.productId)?.code }} · {{ byId.get(component.productId)?.unit ?? 'Unidad del producto base' }}
                </p>
              </div>
              <UFormField :label="`Cantidad por unidad`" :name="`composition.components.${index}.quantity`" class="col-start-1 row-start-2 sm:col-start-auto sm:row-start-auto">
                <UInput
                  v-model="component.quantity"
                  inputmode="decimal"
                  placeholder="0.25"
                  class="w-full"
                  :aria-label="`Cantidad de ${byId.get(component.productId)?.name ?? 'componente'}`"
                />
              </UFormField>
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                aria-label="Quitar componente"
                class="col-start-2 row-start-1 sm:col-start-auto sm:row-start-auto"
                @click="model.composition.components.splice(index, 1)"
              />
            </div>
          </div>
        </UFormField>
      </template>
      <p v-else class="text-sm text-muted">
        Las existencias se controlan directamente sobre este producto.
      </p>
    </div>
  </UCard>
</template>
