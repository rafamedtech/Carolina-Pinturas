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
          class="pointer-events-none fixed right-4 bottom-4 z-[100] flex items-center gap-3 rounded-lg border border-default bg-default px-4 py-3 shadow-lg"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <UIcon name="i-lucide-loader-circle" class="size-5 shrink-0 animate-spin text-primary" />
          <p class="text-sm font-medium text-muted">
            Cargando información de Siigo…
          </p>
          <span class="sr-only">Cargando…</span>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>
