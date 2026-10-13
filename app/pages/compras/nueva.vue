<script setup lang="ts">
import { tableReturnPath } from '~/utils/tableQuery'
import type { PurchaseDraft } from '#shared/schemas/purchase'
import type { PurchaseView } from '~/types/purchases'

useSeoMeta({ title: 'Nueva compra' })
definePageMeta({ key: route => route.fullPath })
const route = useRoute()
const sourceId = typeof route.query.duplicar === 'string' ? route.query.duplicar : ''
const { data: source, error: sourceError } = await useFetch<PurchaseView>(`/api/purchases/${encodeURIComponent(sourceId)}`, {
  immediate: Boolean(sourceId)
})
const returnTo = computed(() => tableReturnPath(route.query.returnTo, '/compras', ['/compras', '/compras/cuentas-por-pagar']))
const cancelTo = computed(() => sourceId
  ? { path: `/compras/${encodeURIComponent(sourceId)}`, query: { returnTo: returnTo.value } }
  : returnTo.value)
const busy = shallowRef(false)
const error = shallowRef('')
let pending: { key: string, requestId: string } | undefined
async function save(draft: PurchaseDraft) {
  if (busy.value) return
  const key = JSON.stringify(draft)
  if (pending?.key !== key) pending = { key, requestId: crypto.randomUUID() }
  busy.value = true
  error.value = ''
  try {
    const result = await $fetch<PurchaseView>('/api/purchases', { method: 'POST', body: { draft, requestId: pending.requestId } })
    await navigateTo({ path: `/compras/${result.id}`, query: { returnTo: returnTo.value } })
  } catch (e) {
    error.value = (e as { data?: { statusMessage?: string } }).data?.statusMessage || 'No se pudo guardar. Reintenta con los mismos datos.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="new-purchase">
    <template #header>
      <UDashboardNavbar title="Nueva compra">
        <template #leading>
          <UButton
            :to="cancelTo"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            aria-label="Volver a compras"
          />
        </template>
      </UDashboardNavbar>
    </template><template #body>
      <UAlert
        v-if="error"
        class="shrink-0"
        :title="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
      />
      <UAlert
        v-if="sourceError"
        class="shrink-0"
        title="No se pudo cargar la orden que quieres duplicar."
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
      />
      <UAlert
        v-else-if="source"
        class="shrink-0"
        :title="`Duplicando OC-${source.folio}`"
        description="Revisa los datos y guarda el nuevo borrador. No se copiarán recepciones, facturas ni pagos."
        color="info"
        variant="subtle"
        icon="i-lucide-copy"
      />
      <PurchasesPurchaseDraftForm
        v-if="!sourceId || source"
        :copy-from="source ?? undefined"
        :busy="busy"
        :cancel-to="cancelTo"
        @save="save"
      />
    </template>
  </UDashboardPanel>
</template>
