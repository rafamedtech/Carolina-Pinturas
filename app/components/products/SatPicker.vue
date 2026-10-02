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
const isLoading = computed(() => status.value === 'pending' || (open.value && !data.value && !error.value))
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
      <div class="flex h-96 flex-col gap-4 sm:h-[28rem]">
        <UInput
          v-model="search"
          :placeholder="`Buscar ${props.label.toLowerCase()}`"
          aria-label="Buscar en catálogo SAT"
          autofocus
          class="w-full"
          icon="i-lucide-search"
        />
        <div class="min-h-0 flex-1">
          <div
            v-if="isLoading"
            class="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted"
            role="status"
          >
            <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin text-primary" />
            <span>Cargando…</span>
          </div>
          <UAlert v-else-if="error" color="error" title="No se pudo consultar el catálogo SAT." />
          <ul v-else class="h-full space-y-1 overflow-y-auto">
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
        </div>
        <div class="flex min-h-8 items-center">
          <UPagination
            v-if="data"
            v-model:page="page"
            :total="data.pagination.total_results"
            :items-per-page="25"
            :disabled="isLoading"
          />
        </div>
        <p class="min-h-4 text-xs text-muted">
          <template v-if="data">
            Catálogo Siigo México · consultado {{ formatDate(data.retrievedAt) }}
          </template>
        </p>
      </div>
    </template>
  </UModal>
</template>
