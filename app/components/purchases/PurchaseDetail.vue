<script setup lang="ts">
import type { PurchaseView } from '~/types/purchases'
import { formatMexicoDateTime } from '~/utils/datetime'
import { purchaseDateLabel, purchaseMoney, purchaseQuantity, purchaseStatus, receiptStatus } from '~/utils/purchaseFormat'

const props = defineProps<{ id: string }>()
const { data: order, error: loadError, refresh, status: loadStatus } = await useFetch<PurchaseView>(`/api/purchases/${props.id}`)
const { busy, error, run } = usePurchaseAction(() => order.value!, (value) => {
  order.value = value
})
const confirmOpen = shallowRef(false)
const cancelOpen = shallowRef(false)
function print() {
  window.print()
}

const money = (value: number) => purchaseMoney(value, order.value?.currencyCode ?? 'MXN')
const status = computed(() => purchaseStatus(order.value?.status ?? ''))
const receipt = computed(() => receiptStatus(order.value?.receiptStatus ?? ''))
const isDraft = computed(() => order.value?.status === 'borrador')
const received = computed(() => {
  const items = order.value?.items ?? []
  const ordered = items.reduce((s, i) => s + i.quantity, 0)
  const done = items.reduce((s, i) => s + i.received, 0)
  return { ordered, done, percent: ordered ? Math.min(100, Math.round(done / ordered * 100)) : 0 }
})
const canCancel = computed(() => Boolean(order.value)
  && order.value!.status !== 'cancelada'
  && !order.value!.receipts.some(r => !r.voidedAt)
  && !order.value!.invoices.some(i => !i.voidedAt))

async function confirmOrder() {
  if (await run({ action: 'confirm' })) confirmOpen.value = false
}
async function cancelOrder(reason: string) {
  if (await run({ action: 'cancel', reason })) cancelOpen.value = false
}

const events: Record<string, { label: string, icon: string }> = {
  create: { label: 'Borrador creado', icon: 'i-lucide-file-plus' },
  edit: { label: 'Borrador editado', icon: 'i-lucide-file-pen' },
  confirm: { label: 'Orden confirmada', icon: 'i-lucide-circle-check' },
  cancel: { label: 'Orden cancelada', icon: 'i-lucide-circle-x' },
  receive: { label: 'Recepción registrada', icon: 'i-lucide-package-check' },
  voidReceipt: { label: 'Recepción anulada', icon: 'i-lucide-package-x' },
  invoice: { label: 'Factura registrada', icon: 'i-lucide-receipt' },
  editInvoice: { label: 'Factura editada', icon: 'i-lucide-receipt' },
  voidInvoice: { label: 'Factura anulada', icon: 'i-lucide-receipt' },
  pay: { label: 'Abono registrado', icon: 'i-lucide-banknote' },
  voidPayment: { label: 'Abono y gasto anulados', icon: 'i-lucide-banknote' }
}
function eventReason(detail: unknown) {
  return detail && typeof detail === 'object' && 'reason' in detail ? String(detail.reason) : ''
}
const timeline = computed(() => [...(order.value?.events ?? [])].reverse())
</script>

<template>
  <UDashboardPanel id="purchase-detail">
    <template #header>
      <UDashboardNavbar :title="order ? `OC-${order.folio}` : 'Compra'">
        <template #leading>
          <UButton
            to="/compras"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            aria-label="Volver a compras"
          />
        </template>
        <template #trailing>
          <UBadge
            v-if="order"
            :label="status.label"
            :color="status.color"
            variant="subtle"
          />
        </template>
        <template #right>
          <UButton
            label="Actualizar"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            aria-label="Actualizar"
            :ui="{ label: 'hidden sm:inline' }"
            :loading="loadStatus === 'pending'"
            @click="refresh()"
          />
          <UButton
            label="Imprimir"
            icon="i-lucide-printer"
            aria-label="Imprimir orden"
            :ui="{ label: 'hidden sm:inline' }"
            :disabled="!order"
            @click="print"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="loadError"
        title="No se pudo cargar la compra."
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
      />

      <template v-if="order">
        <div class="purchase-screen flex flex-col gap-4">
          <UAlert
            v-if="error"
            :title="error"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
          />

          <UCard>
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div class="min-w-0">
                <p class="text-sm text-muted">
                  Proveedor
                </p>
                <p class="truncate text-lg font-semibold text-highlighted">
                  {{ order.providerName }}
                </p>
                <div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                  <span v-if="order.providerRfc" class="inline-flex items-center gap-1"><UIcon name="i-lucide-id-card" class="size-4" />{{ order.providerRfc }}</span>
                  <span class="inline-flex items-center gap-1"><UIcon name="i-lucide-calendar" class="size-4" />{{ purchaseDateLabel(order.date) }}</span>
                  <span class="inline-flex items-center gap-1"><UIcon name="i-lucide-coins" class="size-4" />{{ order.currencyCode }}</span>
                </div>
              </div>
              <div v-if="isDraft" class="flex flex-col gap-2 sm:flex-row">
                <UButton
                  v-if="canCancel"
                  label="Cancelar orden"
                  icon="i-lucide-x"
                  color="error"
                  variant="outline"
                  class="justify-center"
                  :disabled="busy"
                  @click="cancelOpen = true"
                />
                <UButton
                  label="Confirmar orden"
                  icon="i-lucide-circle-check"
                  class="justify-center"
                  :disabled="busy"
                  @click="confirmOpen = true"
                />
              </div>
            </div>

            <div v-if="!isDraft" class="mt-5 grid grid-cols-2 gap-3 border-t border-default pt-5 lg:grid-cols-4">
              <div>
                <p class="text-sm text-muted">
                  Total de la orden
                </p>
                <p class="text-xl font-semibold tabular-nums">
                  {{ money(order.total) }}
                </p>
              </div>
              <div>
                <p class="text-sm text-muted">
                  Facturado
                </p>
                <p class="text-xl font-semibold tabular-nums">
                  {{ money(order.invoiced) }}
                </p>
                <p v-if="order.invoiced && order.invoiced !== order.total" class="text-xs text-warning">
                  {{ order.invoiced > order.total ? '+' : '' }}{{ money(order.invoiced - order.total) }} vs. orden
                </p>
              </div>
              <div>
                <p class="text-sm text-muted">
                  Saldo por pagar
                </p>
                <p class="text-xl font-semibold tabular-nums" :class="order.balance > 0 ? 'text-warning' : order.invoiced > 0 ? 'text-success' : ''">
                  {{ money(order.balance) }}
                </p>
              </div>
              <div>
                <div class="flex items-center justify-between gap-2">
                  <p class="text-sm text-muted">
                    Recepción
                  </p>
                  <UBadge
                    :label="receipt.label"
                    :color="receipt.color"
                    variant="subtle"
                    size="sm"
                  />
                </div>
                <p class="text-xl font-semibold tabular-nums">
                  {{ received.percent }}%
                </p>
                <UProgress
                  :model-value="received.percent"
                  :color="receipt.color"
                  size="sm"
                  class="mt-1"
                />
              </div>
            </div>
          </UCard>

          <PurchasesPurchaseDraftForm
            v-if="isDraft"
            :key="order.version"
            :order="order"
            :busy="busy"
            @save="run({ action: 'edit', draft: $event })"
          />

          <div class="grid gap-4 lg:items-start" :class="isDraft ? '' : 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'">
            <div v-if="!isDraft" class="flex min-w-0 flex-col gap-4">
              <UCard :ui="{ body: 'p-0 sm:p-0' }">
                <template #header>
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <h2 class="font-semibold text-primary">
                        Partidas
                      </h2>
                      <p class="mt-1 text-sm text-muted">
                        {{ order.items.length }} {{ order.items.length === 1 ? 'producto' : 'productos' }}
                      </p>
                    </div>
                    <p class="text-right text-sm text-muted">
                      Total
                      <span class="ms-2 text-base font-semibold text-primary tabular-nums">{{ money(order.total) }}</span>
                    </p>
                  </div>
                </template>
                <div class="hidden gap-3 border-b border-default bg-elevated/50 px-4 py-2 text-xs font-medium text-muted uppercase md:grid md:grid-cols-[minmax(0,1fr)_8rem_8rem_9rem_8rem]">
                  <span>Producto</span><span class="text-right">Cantidad</span><span class="text-right">Recibido</span><span class="text-right">Costo unitario</span><span class="text-right">Importe</span>
                </div>
                <ul class="divide-y divide-default">
                  <li
                    v-for="item in order.items"
                    :key="item.id"
                    class="grid grid-cols-2 gap-x-3 gap-y-1 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_8rem_8rem_9rem_8rem] md:items-center"
                  >
                    <div class="col-span-2 min-w-0 md:col-span-1">
                      <p class="truncate font-medium text-highlighted">
                        {{ item.name }}
                      </p>
                      <p class="text-muted">
                        {{ item.code }}
                      </p>
                    </div>
                    <p class="tabular-nums md:text-right">
                      <span class="text-muted md:hidden">Cantidad: </span>{{ purchaseQuantity(item.quantity) }}
                    </p>
                    <p class="tabular-nums md:text-right" :class="item.received >= item.quantity ? 'text-success' : item.received > 0 ? 'text-warning' : 'text-muted'">
                      <span class="text-muted md:hidden">Recibido: </span>{{ purchaseQuantity(item.received) }}
                    </p>
                    <p class="tabular-nums md:text-right">
                      <span class="text-muted md:hidden">Costo: </span>{{ money(item.unitCost) }}
                    </p>
                    <p class="font-medium tabular-nums md:text-right">
                      <span class="font-normal text-muted md:hidden">Importe: </span>{{ money(item.total) }}
                    </p>
                  </li>
                </ul>
                <template #footer>
                  <div class="flex items-center justify-between gap-4 sm:ms-auto sm:max-w-sm">
                    <span class="font-semibold text-primary">Total ({{ order.currencyCode }})</span>
                    <span class="text-lg font-semibold text-primary tabular-nums">{{ money(order.total) }}</span>
                  </div>
                </template>
              </UCard>

              <PurchasesPurchaseReceipts :order="order" @saved="order = $event" />
              <PurchasesPurchaseInvoices :order="order" @saved="order = $event" />
            </div>

            <div class="flex min-w-0 flex-col gap-4">
              <UCard v-if="!isDraft && order.notes">
                <template #header>
                  <h2 class="font-semibold text-primary">
                    Notas
                  </h2>
                </template>
                <p class="text-sm whitespace-pre-wrap">
                  {{ order.notes }}
                </p>
              </UCard>

              <UCard v-if="!isDraft && canCancel">
                <div class="flex flex-col gap-3">
                  <div>
                    <p class="font-medium">
                      Cancelar orden
                    </p>
                    <p class="text-sm text-muted">
                      Solo es posible mientras no tenga recepciones ni facturas vigentes.
                    </p>
                  </div>
                  <UButton
                    label="Cancelar orden"
                    icon="i-lucide-x"
                    color="error"
                    variant="outline"
                    class="justify-center"
                    :disabled="busy"
                    @click="cancelOpen = true"
                  />
                </div>
              </UCard>

              <UCard>
                <template #header>
                  <h2 class="font-semibold text-primary">
                    Historial
                  </h2>
                </template>
                <p v-if="!timeline.length" class="text-sm text-muted">
                  Sin movimientos.
                </p>
                <ol v-else class="space-y-4">
                  <li v-for="event in timeline" :key="event.id" class="flex gap-3">
                    <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-elevated">
                      <UIcon :name="events[event.action]?.icon || 'i-lucide-circle'" class="size-4 text-muted" />
                    </span>
                    <div class="min-w-0 text-sm">
                      <p class="font-medium">
                        {{ events[event.action]?.label || event.action }}
                      </p>
                      <p class="truncate text-muted">
                        {{ formatMexicoDateTime(event.createdAt) }} · {{ event.createdBy }}
                      </p>
                      <p v-if="eventReason(event.detail)" class="mt-1 text-muted italic">
                        “{{ eventReason(event.detail) }}”
                      </p>
                    </div>
                  </li>
                </ol>
              </UCard>
            </div>
          </div>
        </div>

        <section class="purchase-print hidden space-y-4 text-sm print:block">
          <div class="flex items-start justify-between">
            <div>
              <h1 class="text-2xl font-semibold">
                Orden de compra OC-{{ order.folio }}
              </h1>
              <p>Carolina Pinturas</p>
            </div>
            <div class="text-right">
              <p>Fecha: {{ purchaseDateLabel(order.date) }}</p>
              <p>Estado: {{ status.label }}</p>
              <p>Moneda: {{ order.currencyCode }}</p>
            </div>
          </div>
          <div>
            <p class="font-semibold">
              Proveedor
            </p>
            <p>{{ order.providerName }}{{ order.providerRfc ? ` · RFC ${order.providerRfc}` : '' }}</p>
          </div>
          <table class="w-full border-collapse text-left">
            <thead>
              <tr class="border-b border-black">
                <th class="py-2">
                  Código
                </th><th class="py-2">
                  Producto
                </th><th class="py-2 text-right">
                  Cantidad
                </th><th class="py-2 text-right">
                  Costo unitario
                </th><th class="py-2 text-right">
                  Importe
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in order.items" :key="item.id" class="border-b border-gray-300">
                <td class="py-2">
                  {{ item.code }}
                </td><td class="py-2">
                  {{ item.name }}
                </td><td class="py-2 text-right">
                  {{ purchaseQuantity(item.quantity) }}
                </td><td class="py-2 text-right">
                  {{ money(item.unitCost) }}
                </td><td class="py-2 text-right">
                  {{ money(item.total) }}
                </td>
              </tr>
            </tbody>
          </table>
          <p class="text-right text-lg font-semibold">
            Total: {{ money(order.total) }} {{ order.currencyCode }}
          </p>
          <p v-if="order.notes" class="whitespace-pre-wrap">
            <span class="font-semibold">Notas:</span> {{ order.notes }}
          </p>
        </section>

        <UModal
          v-model:open="confirmOpen"
          title="Confirmar orden"
          description="Confirmar congela proveedor y partidas. Guarda los cambios del borrador antes de continuar."
        >
          <template #body>
            <div class="flex items-center justify-between gap-4 rounded-lg border border-default p-3">
              <div class="min-w-0">
                <p class="truncate font-medium">
                  {{ order.providerName }}
                </p>
                <p class="text-sm text-muted">
                  {{ order.items.length }} {{ order.items.length === 1 ? 'partida' : 'partidas' }}
                </p>
              </div>
              <p class="text-lg font-semibold text-primary tabular-nums">
                {{ money(order.total) }}
              </p>
            </div>
          </template>
          <template #footer>
            <div class="flex w-full justify-end gap-2">
              <UButton
                label="Volver"
                color="neutral"
                variant="outline"
                :disabled="busy"
                @click="confirmOpen = false"
              />
              <UButton
                label="Confirmar definitivamente"
                icon="i-lucide-circle-check"
                :loading="busy"
                @click="confirmOrder"
              />
            </div>
          </template>
        </UModal>

        <PurchasesPurchaseReasonModal
          v-model:open="cancelOpen"
          title="Cancelar orden"
          :description="`OC-${order.folio} quedará cancelada. Esta acción no se puede deshacer.`"
          confirm-label="Cancelar orden"
          :busy="busy"
          @confirm="cancelOrder"
        />
      </template>
    </template>
  </UDashboardPanel>
</template>

<style>
@media print {
  body * { visibility: hidden; }
  .purchase-print, .purchase-print * { visibility: visible; }
  .purchase-print { position: absolute; inset: 0; padding: 20px; color: black; background: white; }
  .purchase-screen { display: none; }
}
</style>
