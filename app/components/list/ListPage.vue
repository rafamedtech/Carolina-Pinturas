<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core'

defineProps<{
  embedded?: boolean
  id: string
  title: string
  loading?: boolean
  error?: boolean
  errorTitle?: string
  errorMessage?: string
}>()

const [DefineBody, ReuseBody] = createReusableTemplate()
const emit = defineEmits<{ refresh: [] }>()

defineSlots<{
  actions(): unknown
  toolbar(): unknown
  views(): unknown
  default(): unknown
  pagination(): unknown
  overlays(): unknown
}>()
</script>

<template>
  <DefineBody>
    <slot name="toolbar" />
    <slot name="views" />
    <UAlert
      v-if="error"
      color="warning"
      variant="subtle"
      :title="errorTitle || `${title} no disponibles`"
      :description="errorMessage"
      icon="i-lucide-database-zap"
    />
    <template v-else>
      <slot />
      <slot name="pagination" />
    </template>
    <slot name="overlays" />
  </DefineBody>
  <section v-if="embedded" class="flex min-w-0 flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="font-semibold text-highlighted">
        {{ title }}
      </h2>
      <div class="flex items-center gap-2">
        <slot name="actions" />
        <UButton
          label="Actualizar"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="outline"
          :aria-label="`Actualizar ${title.toLowerCase()}`"
          :loading="loading"
          @click="emit('refresh')"
        />
      </div>
    </div>
    <ReuseBody />
  </section>
  <UDashboardPanel v-else :id="id">
    <template #header>
      <UDashboardNavbar :title="title">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <slot name="actions" />
          <UButton
            label="Actualizar"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :aria-label="`Actualizar ${title.toLowerCase()}`"
            :ui="{ label: 'hidden sm:inline' }"
            :loading="loading"
            @click="emit('refresh')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <ReuseBody />
    </template>
  </UDashboardPanel>
</template>
