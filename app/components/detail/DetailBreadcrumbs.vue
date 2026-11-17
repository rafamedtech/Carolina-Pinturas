<script setup lang="ts">
import type { BreadcrumbItem } from '@nuxt/ui'

defineProps<{ items: BreadcrumbItem[] }>()
</script>

<template>
  <UDashboardToolbar>
    <UBreadcrumb :items="items" />
  </UDashboardToolbar>
</template>
