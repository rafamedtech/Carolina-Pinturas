<script setup lang="ts">
import { siigoNubeInvoiceCode, siigoNubeInvoiceUrl, SIIGO_NUBE_DOCUMENTS_URL } from '~/utils/siigoNube'

const props = defineProps<{
  orderId: string
  invoiceId: string
  invoiceName: string
  invoiceCode?: number | null
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [code: number] }>()
const url = shallowRef('')
const confirmed = shallowRef(false)
const saving = shallowRef(false)
const errorMessage = shallowRef('')
const validLink = computed(() => siigoNubeInvoiceCode(url.value) !== null)

watch([open, () => props.invoiceId], ([value]) => {
  if (!value) return
  url.value = siigoNubeInvoiceUrl(props.invoiceCode) ?? ''
  confirmed.value = false
  errorMessage.value = ''
})

async function save() {
  if (saving.value || !validLink.value || !confirmed.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    const result = await $fetch<{ invoiceNubeCode: number }>(
      `/api/orders/${encodeURIComponent(props.orderId)}/siigo-invoice/nube-link`,
      { method: 'PATCH', body: { invoiceId: props.invoiceId, url: url.value, confirmed: true } }
    )
    emit('saved', result.invoiceNubeCode)
    open.value = false
  } catch (error) {
    const value = error as { data?: { statusMessage?: string } }
    errorMessage.value = value.data?.statusMessage || 'No fue posible guardar el enlace de la factura.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Vincular factura de Siigo Nube"
    :description="`Guarda el enlace de ${invoiceName} una sola vez para abrir sus pagos con la factura preseleccionada.`"
    :dismissible="!saving"
  >
    <template #body>
      <form id="siigo-invoice-link-form" class="space-y-4" @submit.prevent="save">
        <p class="text-sm text-muted">
          Abre la factura {{ invoiceName }} en Siigo Nube y copia el enlace de la barra de direcciones.
          Siigo no comparte este enlace a través de su API.
        </p>
        <UButton
          label="Buscar factura en Siigo Nube"
          :to="SIIGO_NUBE_DOCUMENTS_URL"
          target="_blank"
          rel="noopener noreferrer"
          icon="i-lucide-external-link"
          color="neutral"
          variant="outline"
        />
        <UFormField
          label="Enlace de la factura en Siigo Nube"
          name="url"
          :error="url && !validLink ? 'Usa el enlace de una factura en siigonube.siigo.mx, con su código numérico.' : undefined"
          required
        >
          <UInput
            v-model="url"
            type="url"
            placeholder="https://siigonube.siigo.mx/#/invoice/843/…"
            class="w-full"
            :disabled="saving"
          />
        </UFormField>
        <UCheckbox
          v-model="confirmed"
          :label="`Confirmo que el enlace corresponde a la factura ${invoiceName} de este pedido.`"
          :disabled="saving"
        />
        <UAlert v-if="errorMessage" color="error" :description="errorMessage" />
      </form>
    </template>
    <template #footer>
      <UButton
        label="Cancelar"
        color="neutral"
        variant="outline"
        :disabled="saving"
        @click="open = false"
      />
      <UButton
        label="Guardar enlace"
        type="submit"
        form="siigo-invoice-link-form"
        :disabled="!validLink || !confirmed || saving"
        :loading="saving"
      />
    </template>
  </UModal>
</template>
