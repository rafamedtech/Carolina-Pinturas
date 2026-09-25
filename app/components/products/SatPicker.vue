<script setup lang="ts">
import type { SatSearchResponse } from '~/types/siigo-products'

const props = defineProps<{ kind: 'unit' | 'key', label: string, disabled?: boolean, historicalName?: string }>()
const model = defineModel<string>({ required: true })
const open = shallowRef(false)
const search = shallowRef('')
const debouncedSearch = refDebounced(search, 250)
const page = shallowRef(1)
const selectedName = shallowRef('')
watch(debouncedSearch, () => {
  page.value = 1
})
const { data, status, error, refresh } = useFetch<SatSearchResponse>('/api/siigo/products/sat', {
  query: computed(() => ({ kind: props.kind, q: debouncedSearch.value, page: page.value })),
  immediate: false, server: false
})
watch(open, (value) => {
  if (value) refresh()
})
const label = computed(() => model.value ? `${model.value}${selectedName.value || props.historicalName ? ` · ${selectedName.value || props.historicalName}` : ''}` : `Seleccionar ${props.label.toLowerCase()}`)
</script>

<template>
  <UModal v-model:open="open" :title="label" :description="`Buscar ${props.label.toLowerCase()} por código o descripción.`">
    <UButton
      :label="label"
      :disabled="disabled"
      color="neutral"
      variant="outline"
      class="w-full justify-start"
      icon="i-lucide-search"
    />
    <template #body>
      <div class="space-y-4">
        <UInput
          v-model="search"
          :placeholder="`Buscar ${props.label.toLowerCase()}`"
          aria-label="Buscar en catálogo SAT"
          autofocus
          class="w-full"
          icon="i-lucide-search"
        />
        <UAlert v-if="error" color="error" title="No se pudo consultar el catálogo SAT." />
        <div v-if="status === 'pending'" role="status">
          Buscando…
        </div>
        <ul v-else class="max-h-80 space-y-1 overflow-y-auto">
          <li v-for="entry in data?.results" :key="entry.code">
            <UButton
              :label="`${entry.code} · ${entry.name}`"
              color="neutral"
              variant="ghost"
              class="w-full justify-start text-left whitespace-normal"
              @click="model = entry.code; selectedName = entry.name; open = false"
            />
          </li>
          <li v-if="data && !data.results.length" class="p-3 text-muted">
            Sin coincidencias.
          </li>
        </ul>
        <UPagination
          v-if="data"
          v-model:page="page"
          :total="data.pagination.total_results"
          :items-per-page="25"
          :disabled="status === 'pending'"
        />
        <p v-if="data" class="text-xs text-muted">
          Catálogo Siigo México · consultado {{ data.retrievedAt }}
        </p>
      </div>
    </template>
  </UModal>
</template>
