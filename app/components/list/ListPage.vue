<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core'

withDefaults(defineProps<{
  embedded?: boolean
  id: string
  title: string
  titleIcon?: string
  loading?: boolean
  showRefresh?: boolean
  error?: boolean
  errorTitle?: string
  errorMessage?: string
  viewsBeforeToolbar?: boolean
}>(), { showRefresh: true })

const [DefineBody, ReuseBody] = createReusableTemplate()
const [DefineContent, ReuseContent] = createReusableTemplate()
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
  <DefineContent>
    <UAlert
      v-if="error"
      color="warning"
      variant="subtle"
      :title="errorTitle || `${title} no disponibles`"
      :description="errorMessage"
      icon="i-lucide-database-zap"
    />
    <slot v-else />
  </DefineContent>
  <DefineBody>
    <div v-if="viewsBeforeToolbar" class="flex min-w-0 flex-col gap-3">
      <slot name="views" />
      <slot name="toolbar" />
      <ReuseContent />
    </div>
    <template v-else>
      <slot name="toolbar" />
      <slot name="views" />
      <ReuseContent />
    </template>
    <slot v-if="!error" name="pagination" />
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
          v-if="showRefresh"
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
  <UDashboardPanel
    v-else
    :id="id"
    :ui="viewsBeforeToolbar ? { body: 'pt-3 sm:pt-0.5' } : undefined"
  >
    <template #header>
      <DetailHeader
        :title="title"
        :title-icon="titleIcon"
        :refresh-label="`Actualizar ${title.toLowerCase()}`"
        :loading="loading"
        :show-refresh="showRefresh"
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
