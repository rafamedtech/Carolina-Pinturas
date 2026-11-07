<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core'
import type { BreadcrumbItem } from '@nuxt/ui'

defineProps<{
  embedded?: boolean
  id: string
  title: string
  loading?: boolean
  error?: boolean
  errorTitle?: string
  errorMessage?: string
  viewsBeforeToolbar?: boolean
  breadcrumbs?: BreadcrumbItem[]
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
    <slot v-if="viewsBeforeToolbar" name="views" />
    <slot name="toolbar" />
    <slot v-if="!viewsBeforeToolbar" name="views" />
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
      <DetailHeader
        :title="title"
        :breadcrumbs="breadcrumbs"
        :refresh-label="`Actualizar ${title.toLowerCase()}`"
        :loading="loading"
        @refresh="emit('refresh')"
      >
        <template #actions>
          <slot name="actions" />
        </template>
      </DetailHeader>
    </template>

    <template #body>
      <ReuseBody />
    </template>
  </UDashboardPanel>
</template>
