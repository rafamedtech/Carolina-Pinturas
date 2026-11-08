<script setup lang="ts">
import type { BreadcrumbItem } from '@nuxt/ui'

defineProps<{ title: string, breadcrumbs?: BreadcrumbItem[], loading?: boolean, refreshLabel: string }>()
const emit = defineEmits<{ refresh: [] }>()
</script>

<template>
  <UDashboardNavbar :title="title">
    <template #leading>
      <UDashboardSidebarCollapse />
    </template>
    <template #right>
      <slot name="actions" />
      <AppButton
        label="Actualizar"
        :aria-label="refreshLabel"
        :ui="{ label: 'hidden sm:inline' }"
        icon="i-lucide-refresh-cw"
        intent="secondary"
        :loading="loading"
        @click="emit('refresh')"
      />
    </template>
  </UDashboardNavbar>
  <UDashboardToolbar v-if="breadcrumbs?.length">
    <UBreadcrumb :items="breadcrumbs" />
  </UDashboardToolbar>
</template>
