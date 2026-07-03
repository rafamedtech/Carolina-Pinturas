<script setup lang="ts">
defineProps<{
  saving: boolean
  disabled: boolean
}>()
</script>

<template>
  <div class="mt-auto flex flex-col-reverse gap-3 border-t border-default pt-4 sm:flex-row sm:items-center sm:justify-between">
    <p class="text-sm text-muted">
      Los datos del producto se congelarán en el pedido al guardarlo.
    </p>
    <div class="flex gap-2">
      <UButton
        to="/ventas"
        label="Cancelar"
        color="neutral"
        variant="outline"
        :disabled="saving"
      />
      <UButton
        type="submit"
        label="Revisar pedido"
        icon="i-lucide-clipboard-check"
        :loading="saving"
        :disabled="disabled"
      />
    </div>
  </div>
</template>
