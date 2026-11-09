<script setup lang="ts">
import type { BreadcrumbItem } from '@nuxt/ui'

withDefaults(defineProps<{ title: string, breadcrumbs?: BreadcrumbItem[], loading?: boolean, refreshLabel?: string, showRefresh?: boolean }>(), { refreshLabel: 'Actualizar', showRefresh: true })
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
        v-if="showRefresh"
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
