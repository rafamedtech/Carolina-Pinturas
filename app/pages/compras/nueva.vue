<script setup lang="ts">
import type { PurchaseDraft } from '#shared/schemas/purchase'
import type { PurchaseView } from '~/types/purchases'

useSeoMeta({ title: 'Nueva compra' })
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
    await navigateTo(`/compras/${result.id}`)
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
          <UDashboardSidebarCollapse />
        </template><template #right>
          <UButton to="/compras" label="Volver" variant="ghost" />
        </template>
      </UDashboardNavbar>
    </template><template #body>
      <UAlert v-if="error" :title="error" color="error" /><UCard><PurchasesPurchaseDraftForm :busy="busy" @save="save" /></UCard>
    </template>
  </UDashboardPanel>
</template>
