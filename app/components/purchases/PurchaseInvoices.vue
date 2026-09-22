<script setup lang="ts">
import { mexicoToday } from '~/utils/datetime'
import type { PurchaseView } from '~/types/purchases'
import { purchaseMoney } from '~/utils/purchaseFormat'

const props = defineProps<{ order: PurchaseView }>()
const emit = defineEmits<{ saved: [order: PurchaseView] }>()
const { busy, error, run } = usePurchaseAction(() => props.order, o => emit('saved', o))
const formOpen = shallowRef(false)
const form = reactive({ folio: '', date: mexicoToday(), dueDate: mexicoToday(), amount: 0 })
const money = (value: number) => purchaseMoney(value, props.order.currencyCode)
const difference = computed(() => props.order.invoiced - props.order.total)

function openForm() {
  form.amount = Math.max(0, Number((props.order.total - props.order.invoiced).toFixed(2)))
  formOpen.value = true
}
async function add() {
  if (await run({ action: 'invoice', ...form })) {
    form.folio = ''
    form.amount = 0
    formOpen.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="font-semibold text-primary">
          Facturas y abonos
        </h2>
        <UButton
          v-if="order.status === 'confirmada' && !formOpen"
          label="Registrar factura"
          icon="i-lucide-receipt"
          size="sm"
          @click="openForm"
        />
      </div>
    </template>

    <div class="flex flex-col gap-4">
      <div class="grid grid-cols-3 gap-3 rounded-lg bg-elevated/50 p-3 text-sm">
        <div>
          <p class="text-muted">
            Facturado
          </p>
          <p class="font-semibold tabular-nums">
            {{ money(order.invoiced) }}
          </p>
        </div>
        <div>
          <p class="text-muted">
            Diferencia
          </p>
          <p class="font-semibold tabular-nums" :class="order.invoiced && difference ? 'text-warning' : ''">
            <template v-if="order.invoiced">
              {{ difference > 0 ? '+' : '' }}{{ money(difference) }}
            </template>
            <template v-else>
              —
            </template>
          </p>
        </div>
        <div>
          <p class="text-muted">
            Saldo
          </p>
          <p class="font-semibold tabular-nums" :class="order.balance > 0 ? 'text-warning' : ''">
            {{ money(order.balance) }}
          </p>
        </div>
      </div>

      <UAlert
        v-if="error"
        :title="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
      />

      <form v-if="order.status === 'confirmada' && formOpen" class="grid gap-3 rounded-lg border border-default p-4 sm:grid-cols-2" @submit.prevent="add">
        <UFormField label="Folio de factura" required>
          <UInput
            v-model="form.folio"
            required
            :maxlength="100"
            autofocus
            class="w-full"
          />
        </UFormField>
        <UFormField :label="`Importe real (${order.currencyCode})`" required>
          <UInputNumber
            v-model="form.amount"
            :min="0.01"
            :step="0.01"
            :step-snapping="false"
            :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }"
            :increment="false"
            :decrement="false"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Fecha de factura">
          <PurchasesPurchaseDate v-model="form.date" />
        </UFormField>
        <UFormField label="Vencimiento">
          <PurchasesPurchaseDate v-model="form.dueDate" />
        </UFormField>
        <div class="flex justify-end gap-2 sm:col-span-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            :disabled="busy"
            @click="formOpen = false"
          />
          <UButton
            type="submit"
            label="Guardar factura"
            icon="i-lucide-save"
            :loading="busy"
            :disabled="!form.folio.trim() || !(form.amount > 0)"
          />
        </div>
      </form>

      <p v-if="!order.invoices.length && !formOpen" class="py-4 text-center text-sm text-muted">
        Aún no se registran facturas.
      </p>

      <PurchasesPurchaseInvoice
        v-for="invoice in order.invoices"
        :key="invoice.id + ':' + order.version"
        :order="order"
        :invoice="invoice"
        @saved="emit('saved', $event)"
      />
    </div>
  </UCard>
</template>
