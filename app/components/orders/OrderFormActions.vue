<script setup lang="ts">
defineProps<{
  saving: boolean
  savingDraft: boolean
  disabled: boolean
  quoteMode?: boolean
  cancelTo?: string
}>()

const emit = defineEmits<{
  saveDraft: []
}>()
</script>

<template>
  <div class="mt-auto flex flex-col-reverse gap-3 border-t border-default pt-4 sm:flex-row sm:items-center sm:justify-between">
    <p class="text-sm text-muted">
      Los datos del producto se congelarán en {{ quoteMode ? 'la cotización' : 'el pedido' }} al guardarlo.
    </p>
    <div class="flex flex-col gap-2 sm:flex-row">
      <UButton
        :to="cancelTo || '/ventas'"
        label="Cancelar"
        icon="i-lucide-x"
        color="neutral"
        variant="outline"
        class="justify-center"
        :disabled="saving"
      />
      <UButton
        :label="quoteMode ? 'Guardar cotización' : 'Guardar como cotización'"
        icon="i-lucide-file-text"
        color="neutral"
        variant="subtle"
        class="justify-center"
        :loading="savingDraft"
        :disabled="disabled"
        @click="emit('saveDraft')"
      />
      <UButton
        v-if="!quoteMode"
        type="submit"
        label="Revisar pedido"
        icon="i-lucide-clipboard-check"
        class="justify-center"
        :loading="saving && !savingDraft"
        :disabled="disabled"
      />
    </div>
  </div>
</template>
