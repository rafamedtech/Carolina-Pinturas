<script setup lang="ts">
import type { BreadcrumbItem } from '@nuxt/ui'

withDefaults(defineProps<{ title: string, titleIcon?: string, breadcrumbs?: BreadcrumbItem[], loading?: boolean, refreshLabel?: string, showRefresh?: boolean }>(), { refreshLabel: 'Actualizar', showRefresh: true })
const emit = defineEmits<{ refresh: [] }>()
</script>

<template>
  <UDashboardNavbar :title="title">
    <template #leading>
      <UDashboardSidebarCollapse />
      <UIcon
        v-if="titleIcon"
        :name="titleIcon"
        aria-hidden="true"
        class="size-5 shrink-0 text-muted"
      />
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
  <DetailBreadcrumbs v-if="breadcrumbs?.length" :items="breadcrumbs" />
</template>
