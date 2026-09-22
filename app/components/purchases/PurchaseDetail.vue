<script setup lang="ts">
import type { PurchaseView } from '~/types/purchases'

const props = defineProps<{ id: string }>()
const { data: order, error: loadError, refresh } = await useFetch<PurchaseView>(`/api/purchases/${props.id}`)
const { busy, error, run } = usePurchaseAction(() => order.value!, (value) => {
  order.value = value
})
const reason = shallowRef('')
const showConfirm = shallowRef(false)
function print() {
  window.print()
}
const actions: Record<string, string> = { create: 'Borrador creado', edit: 'Borrador editado', confirm: 'Orden confirmada', cancel: 'Orden cancelada', receive: 'Recepción registrada', voidReceipt: 'Recepción anulada', invoice: 'Factura registrada', editInvoice: 'Factura editada', voidInvoice: 'Factura anulada', pay: 'Abono registrado', voidPayment: 'Abono y gasto anulados' }
function eventReason(detail: unknown) {
  return detail && typeof detail === 'object' && 'reason' in detail ? String(detail.reason) : ''
}
</script>

<template>
  <UDashboardPanel id="purchase-detail">
    <template #header>
      <UDashboardNavbar :title="order ? `Compra OC-${order.folio}` : 'Compra'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template><template #right>
          <UButton to="/compras" label="Compras" variant="ghost" /><UButton label="Recargar" variant="ghost" @click="refresh()" /><UButton
            label="Imprimir orden"
            icon="i-lucide-printer"
            :disabled="!order"
            @click="print"
          />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <UAlert v-if="loadError" title="No se pudo cargar la compra." color="error" />
      <div v-if="order" class="space-y-6">
        <section class="purchase-print space-y-3">
          <h1 class="text-2xl font-semibold">
            Orden de compra OC-{{ order.folio }}
          </h1>
          <p>{{ order.providerName }}{{ order.providerRfc ? ` · ${order.providerRfc}` : '' }} · {{ order.date }}</p>
          <p>Estado: {{ order.status }} · Moneda: {{ order.currencyCode }}</p>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead>
                <tr class="border-b border-default">
                  <th class="p-2">
                    Producto
                  </th><th class="p-2">
                    Cantidad
                  </th><th class="p-2">
                    Costo final
                  </th><th class="p-2">
                    Importe
                  </th>
                </tr>
              </thead><tbody>
                <tr v-for="item in order.items" :key="item.id" class="border-b border-default">
                  <td class="p-2">
                    {{ item.code }} · {{ item.name }}
                  </td><td class="p-2">
                    {{ item.quantity }}
                  </td><td class="p-2">
                    {{ item.unitCost }}
                  </td><td class="p-2">
                    {{ item.total.toFixed(2) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-right text-xl font-semibold">
            Total: {{ order.total.toFixed(2) }} {{ order.currencyCode }}
          </p><p>{{ order.notes }}</p>
        </section>
        <div class="purchase-screen space-y-6">
          <UAlert v-if="error" :title="error" color="error" />
          <PurchasesPurchaseDraftForm
            v-if="order.status === 'borrador'"
            :key="order.version"
            :order="order"
            :busy="busy"
            @save="run({ action: 'edit', draft: $event })"
          />
          <UButton
            v-if="order.status === 'borrador'"
            label="Confirmar orden"
            :disabled="busy"
            @click="showConfirm = true"
          />
          <UAlert v-if="showConfirm && order.status === 'borrador'" title="Confirmar congela proveedor y partidas." description="Guarda cambios del borrador antes de confirmar.">
            <template #actions>
              <UButton label="Confirmar definitivamente" :loading="busy" @click="run({ action: 'confirm' }).then(ok => { if (ok) showConfirm = false })" /><UButton label="Volver" variant="ghost" @click="showConfirm = false" />
            </template>
          </UAlert>
          <PurchasesPurchaseReceipts v-if="order.status !== 'borrador'" :order="order" @saved="order = $event" />
          <PurchasesPurchaseInvoices v-if="order.status !== 'borrador'" :order="order" @saved="order = $event" />
          <UCard v-if="order.status !== 'cancelada' && !order.receipts.some(r => !r.voidedAt) && !order.invoices.some(i => !i.voidedAt)">
            <div class="flex flex-wrap gap-3">
              <UInput
                v-model="reason"
                placeholder="Motivo de cancelación"
                aria-label="Motivo de cancelación"
                class="flex-1"
              /><UButton
                label="Cancelar orden"
                color="error"
                variant="outline"
                :disabled="reason.trim().length < 3 || busy"
                @click="run({ action: 'cancel', reason })"
              />
            </div>
          </UCard>
          <UCard>
            <template #header>
              <h2 class="font-semibold">
                Historial
              </h2>
            </template><p v-for="event in order.events" :key="event.id" class="py-2 text-sm">
              {{ event.createdAt.slice(0, 19).replace('T', ' ') }} UTC · {{ actions[event.action] || event.action }} · {{ event.createdBy }} {{ eventReason(event.detail) ? `· ${eventReason(event.detail)}` : '' }}
            </p>
          </UCard>
        </div>
      </div>
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
