<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ title: string, description?: string, confirmLabel: string, busy: boolean }>()
const emit = defineEmits<{ confirm: [reason: string] }>()
const reason = shallowRef('')
watch(open, (value) => {
  if (value) reason.value = ''
})
</script>

<template>
  <UModal v-model:open="open" :title="props.title" :description="props.description">
    <template #body>
      <UFormField label="Motivo" required hint="Mínimo 3 caracteres">
        <UTextarea
          v-model="reason"
          :maxlength="1000"
          :rows="3"
          autofocus
          :ui="{ base: 'resize-none' }"
          class="w-full"
        />
      </UFormField>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Volver"
          color="neutral"
          variant="outline"
          :disabled="busy"
          @click="open = false"
        />
        <UButton
          :label="props.confirmLabel"
          color="error"
          :loading="busy"
          :disabled="reason.trim().length < 3"
          @click="emit('confirm', reason.trim())"
        />
      </div>
    </template>
  </UModal>
</template>
