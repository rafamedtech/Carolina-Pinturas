<script setup lang="ts">
defineProps<{
  id: string
  title: string
  loading?: boolean
  error?: boolean
  errorTitle?: string
  errorMessage?: string
}>()

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
  <UDashboardPanel :id="id">
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
    </template>
  </UDashboardPanel>
</template>
