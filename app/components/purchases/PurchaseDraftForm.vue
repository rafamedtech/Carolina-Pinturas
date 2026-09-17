<script setup lang="ts">
import { mexicoToday } from '~/utils/datetime'
import Decimal from 'decimal.js'
import type { PurchaseDraft } from '#shared/schemas/purchase'
import type { SiigoCustomer, SiigoProduct, SiigoListResponse } from '~/types/siigo'
import type { PurchaseView } from '~/types/purchases'

const props = defineProps<{ order?: PurchaseView, busy: boolean }>()
const emit = defineEmits<{ save: [draft: PurchaseDraft] }>()
const { data: suppliers, error: supplierError } = await useFetch<SiigoListResponse<SiigoCustomer>>('/api/siigo/customers', { query: { all: 'true', customer_type: 'Supplier' } })
const { data: products, error: productError } = await useFetch<SiigoListResponse<SiigoProduct>>('/api/siigo/products', { query: { all: 'true', active: 'true' } })
const draft = reactive<PurchaseDraft>({ providerId: props.order?.providerId ?? '', date: props.order?.date ?? mexicoToday(), currencyCode: props.order?.currencyCode ?? 'MXN', notes: props.order?.notes ?? '', items: props.order?.items.map(i => ({ productId: i.productId, quantity: i.quantity, unitCost: i.unitCost })) ?? [] })
const supplierOptions = computed(() => suppliers.value?.results.filter(p => p.active !== false).map(p => ({ label: p.name.join(' '), value: p.id })) ?? [])
const productOptions = computed(() => products.value?.results.map(p => ({ label: `${p.code} · ${p.name}`, value: p.id })) ?? [])
const selectedProduct = shallowRef<string>()
const total = computed(() => draft.items.reduce((s, i) => s.plus(new Decimal(i.quantity || 0).mul(i.unitCost || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)), new Decimal(0)).toFixed(2))
function addProduct() {
  if (!selectedProduct.value || draft.items.some(i => i.productId === selectedProduct.value)) return
  draft.items.push({ productId: selectedProduct.value, quantity: 1, unitCost: 0 })
  selectedProduct.value = undefined
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="emit('save', draft)">
    <UAlert v-if="supplierError || productError" color="error" title="No se pudieron consultar catálogos de Siigo. Recarga para continuar." />
    <div class="grid gap-4 md:grid-cols-3">
      <UFormField label="Proveedor" required>
        <USelectMenu
          v-model="draft.providerId"
          :items="supplierOptions"
          value-key="value"
          placeholder="Selecciona proveedor"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Fecha" required>
        <PurchasesPurchaseDate v-model="draft.date" />
      </UFormField>
      <UFormField label="Moneda">
        <USelect v-model="draft.currencyCode" :items="['MXN', 'USD']" class="w-full" />
      </UFormField>
    </div>
    <UFormField label="Agregar producto">
      <div class="flex gap-2">
        <USelectMenu
          v-model="selectedProduct"
          :items="productOptions"
          value-key="value"
          placeholder="Buscar producto"
          class="w-full"
        /><UButton label="Agregar" :disabled="!selectedProduct" @click="addProduct" />
      </div>
    </UFormField>
    <div v-for="(item, index) in draft.items" :key="item.productId" class="grid gap-3 rounded-lg border border-default p-4 md:grid-cols-[2fr_1fr_1fr_auto]">
      <p class="self-center">
        {{ productOptions.find(p => p.value === item.productId)?.label || props.order?.items.find(p => p.productId === item.productId)?.name }}
      </p>
      <UFormField label="Cantidad">
        <UInput
          v-model.number="item.quantity"
          type="number"
          :min="0.000001"
          step="0.000001"
          required
          class="w-full"
        />
      </UFormField>
      <UFormField label="Costo unitario con impuestos">
        <UInput
          v-model.number="item.unitCost"
          type="number"
          :min="0.000001"
          step="0.000001"
          required
          class="w-full"
        />
      </UFormField>
      <UButton
        icon="i-lucide-trash-2"
        aria-label="Quitar partida"
        color="neutral"
        variant="ghost"
        @click="draft.items.splice(index, 1)"
      />
    </div>
    <UFormField label="Notas">
      <UTextarea v-model="draft.notes" class="w-full" :maxlength="2000" />
    </UFormField>
    <div class="flex items-center justify-between">
      <strong>Total: {{ total }} {{ draft.currencyCode }}</strong><UButton
        type="submit"
        label="Guardar borrador"
        :loading="busy"
        :disabled="!draft.items.length || !draft.providerId || Boolean(supplierError || productError)"
      />
    </div>
  </form>
</template>
