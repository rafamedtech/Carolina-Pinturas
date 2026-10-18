<template>
  <div
    class="flex min-h-64 shrink-0 flex-col items-center justify-center gap-3 py-16"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" aria-hidden="true" />
    <p class="text-sm text-muted">
      Cargando
    </p>
  </div>
</template>
