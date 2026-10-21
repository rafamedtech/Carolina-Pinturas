<script setup lang="ts">
import type { SiigoListResponse, SiigoProduct } from '~/types/siigo'

const model = defineModel<string>({ required: true })
const searchTerm = shallowRef('')
const open = shallowRef(false)
const createdBrands = ref<string[]>([])
const { data, error } = useFetch<SiigoListResponse<SiigoProduct>>('/api/siigo/products', {
  key: 'product-brand-options',
  query: { all: 'true', active: 'all', products_only: 'true' },
  server: false,
  lazy: true
})
const brands = computed(() => {
  const unique = new Map<string, string>()
  const values = [model.value, ...createdBrands.value, ...(data.value?.results ?? []).map(product => product.additional_fields?.brand ?? '')]
  for (const value of values) {
    const brand = value.trim()
    if (brand && !unique.has(brand.toLocaleLowerCase('es-MX'))) unique.set(brand.toLocaleLowerCase('es-MX'), brand)
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b, 'es-MX'))
})
const selectedBrand = computed({
  get: () => model.value || undefined,
  set: (value: string | undefined) => { model.value = value ?? '' }
})
const canCreate = computed(() => {
  const value = searchTerm.value.trim()
  return value.length > 0 && value.length <= 50 && !brands.value.some(brand => brand.toLocaleLowerCase('es-MX') === value.toLocaleLowerCase('es-MX'))
})
function createBrand(value: string) {
  const brand = value.trim()
  if (!canCreate.value) return
  createdBrands.value.push(brand)
  model.value = brand
  searchTerm.value = ''
  open.value = false
}
</script>

<template>
  <div class="flex items-center gap-1">
    <USelectMenu
      v-model:open="open"
      v-model="selectedBrand"
      v-model:search-term="searchTerm"
      :items="brands"
      :search-input="{ placeholder: 'Buscar marca…', maxlength: 50 }"
      :create-item="canCreate ? { when: 'always', position: 'bottom' } : false"
      placeholder="Seleccionar o crear marca"
      aria-label="Marca"
      class="min-w-0 flex-1"
      @create="createBrand"
    >
      <template #create-item-label="{ item }">
        Crear marca “{{ item.trim() }}”
      </template>
    </USelectMenu>
    <UButton
      v-if="model"
      icon="i-lucide-x"
      aria-label="Quitar marca"
      color="neutral"
      variant="ghost"
      @click="model = ''"
    />
  </div>
  <p v-if="error" class="mt-1 text-sm text-muted">
    No se pudieron cargar las marcas. Puedes escribir y crear una nueva.
  </p>
</template>
