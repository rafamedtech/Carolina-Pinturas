<script setup lang="ts">
const { isLoading } = useSiigoLoading()
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200 ease-out"
        leave-active-class="transition-opacity duration-200 ease-in"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isLoading"
          class="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-default/80 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <UIcon name="i-lucide-loader-circle" class="size-10 animate-spin text-primary" />
          <p class="text-sm font-medium text-muted">
            Cargando información de Siigo…
          </p>
          <span class="sr-only">Cargando…</span>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>
