<script setup lang="ts">
import type { DashboardDailySale } from '~/types/dashboard'

defineProps<{
  data: DashboardDailySale[]
}>()
</script>

<template>
  <UCard class="shrink-0" :ui="{ header: 'pb-0', body: 'px-4! pt-3! pb-3!' }">
    <template #header>
      <div>
        <h2 class="text-lg font-semibold text-highlighted">
          Ventas de los últimos 7 días
        </h2>
        <USkeleton class="mt-3 h-8 w-40" />
      </div>
    </template>

    <USkeleton class="h-80 w-full rounded-lg" />
  </UCard>
</template>
