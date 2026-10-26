<script setup lang="ts">
import type { CustomerBalanceSummary } from '#shared/types/customerBalance'

const props = defineProps<{ customerId: string }>()
const emit = defineEmits<{ change: [summary: CustomerBalanceSummary | null] }>()
const summary = shallowRef<CustomerBalanceSummary | null>(null)
watch(summary, value => emit('change', value), { flush: 'sync' })
const loading = shallowRef(false)
const failed = shallowRef(false)

watch(() => props.customerId, async (customerId, _, onCleanup) => {
  const controller = new AbortController()
  onCleanup(() => controller.abort())
  summary.value = null
  failed.value = false
  loading.value = Boolean(customerId)
  if (!customerId) return
  try {
    const result = await $fetch<CustomerBalanceSummary>(`/api/orders/customers/${encodeURIComponent(customerId)}/balance`, {
      signal: controller.signal
    })
    if (!controller.signal.aborted) summary.value = result
  } catch {
    if (!controller.signal.aborted) failed.value = true
  } finally {
    if (!controller.signal.aborted) loading.value = false
  }
}, { immediate: true })

const indicator = computed(() => {
  if (!summary.value) return null
  switch (summary.value.status) {
    case 'current': return { text: 'Cliente al corriente', icon: 'i-lucide-circle-check', color: 'text-success' }
    case 'recent': return { text: 'Cliente con pedidos recientes', icon: 'i-lucide-triangle-alert', color: 'text-warning' }
    case 'overdue': return { text: 'Cliente con saldo vencido', icon: 'i-lucide-circle-alert', color: 'text-error' }
  }
  return null
})
const detail = computed(() => summary.value
  ? `Saldo pendiente: ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(summary.value.balance)} · Pedidos con saldo: ${summary.value.pendingOrders} · Recientes sin abonos: ${summary.value.recentUnpaidOrders} · Vencidos: ${summary.value.overdueOrders}`
  : undefined)
</script>

<template>
  <span role="status" aria-live="polite" class="inline-flex items-center gap-1 text-xs font-medium">
    <span v-if="loading" class="text-muted">Consultando saldo…</span>
    <span v-else-if="failed" class="text-muted">No se pudo consultar el saldo</span>
    <span
      v-else-if="indicator"
      :class="['inline-flex items-center gap-1', indicator.color]"
      :title="detail"
      :aria-label="`${indicator.text}. ${detail}`"
    >
      <UIcon :name="indicator.icon" class="size-4 shrink-0" aria-hidden="true" />
      {{ indicator.text }}
    </span>
  </span>
</template>
