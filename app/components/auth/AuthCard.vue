<script setup lang="ts">
defineProps<{
  title: string
  description: string
}>()

defineSlots<{
  default(): unknown
}>()
</script>

<template>
  <main class="min-h-screen bg-default flex items-center justify-center p-6">
    <UCard class="w-full max-w-md" :ui="{ header: 'p-6 sm:px-7', body: 'p-6 sm:px-7' }">
      <template #header>
        <div class="flex items-center gap-3">
          <div class="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <UIcon name="i-lucide-paint-roller" class="size-5" />
          </div>
          <div>
            <h1 class="font-semibold text-highlighted">
              {{ title }}
            </h1>
            <p class="text-sm text-muted">
              {{ description }}
            </p>
          </div>
        </div>
      </template>

      <slot />
    </UCard>
  </main>
</template>
