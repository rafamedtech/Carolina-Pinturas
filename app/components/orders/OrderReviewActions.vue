<script setup lang="ts">
type OrderReviewSubmissionIntent = 'draft' | 'save' | 'save-and-pay'

defineProps<{
  isDeliverySale: boolean
  isCounterSale: boolean
  maySaveDraft: boolean
  mayManagePayment: boolean
  saving: boolean
  submissionIntent: OrderReviewSubmissionIntent | null
  sendBlocked: boolean
  sendButtonLabel: string
  documentNoun: string
}>()

const emit = defineEmits<{
  edit: []
  submit: [intent: OrderReviewSubmissionIntent]
}>()
</script>

<template>
  <div class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
    <UButton
      :label="isCounterSale || isDeliverySale ? 'Editar' : `Editar ${documentNoun}`"
      icon="i-lucide-pencil"
      color="neutral"
      variant="outline"
      class="justify-center"
      :disabled="saving"
      @click="emit('edit')"
    />

    <UButton
      v-if="isDeliverySale"
      label="Enviar"
      icon="i-lucide-send"
      class="justify-center"
      :loading="saving && submissionIntent === 'save'"
      :disabled="saving || sendBlocked"
      @click="emit('submit', 'save')"
    />

    <template v-else>
      <UButton
        v-if="isCounterSale || maySaveDraft"
        :label="isCounterSale ? 'Guardar pedido' : 'Guardar cotización'"
        icon="i-lucide-save"
        color="neutral"
        variant="soft"
        class="justify-center"
        :loading="saving && (isCounterSale
          ? submissionIntent === 'save'
          : submissionIntent === 'draft')"
        :disabled="saving"
        @click="emit('submit', isCounterSale ? 'save' : 'draft')"
      />
      <UButton
        v-if="!isCounterSale || mayManagePayment"
        :label="isCounterSale ? 'Guardar y pagar' : sendButtonLabel"
        :icon="isCounterSale ? 'i-lucide-circle-dollar-sign' : 'i-lucide-send'"
        class="justify-center"
        :loading="saving && (isCounterSale
          ? submissionIntent === 'save-and-pay'
          : submissionIntent === 'save')"
        :disabled="saving || sendBlocked"
        @click="emit('submit', isCounterSale ? 'save-and-pay' : 'save')"
      />
    </template>
  </div>
</template>
