<script setup lang="ts">
import { mexicoToday } from '~/utils/datetime'
import Decimal from 'decimal.js'
import type { PurchaseDraft } from '#shared/schemas/purchase'
import type { SiigoCustomer, SiigoProduct, SiigoListResponse } from '~/types/siigo'
import type { PurchaseView } from '~/types/purchases'

const props = defineProps<{ order?: PurchaseView, busy: boolean, cancelTo?: string }>()
const emit = defineEmits<{ save: [draft: PurchaseDraft] }>()
const { data: suppliers, error: supplierError, status: supplierStatus } = await useFetch<SiigoListResponse<SiigoCustomer>>('/api/siigo/customers', { query: { all: 'true', customer_type: 'Supplier' } })
const { data: products, error: productError, status: productStatus } = await useFetch<SiigoListResponse<SiigoProduct>>('/api/siigo/products', { query: { all: 'true', active: 'true' } })
const draft = reactive<PurchaseDraft>({ providerId: props.order?.providerId ?? '', date: props.order?.date ?? mexicoToday(), currencyCode: props.order?.currencyCode ?? 'MXN', notes: props.order?.notes ?? '', items: props.order?.items.map(i => ({ productId: i.productId, quantity: i.quantity, unitCost: i.unitCost })) ?? [] })
const catalogError = computed(() => Boolean(supplierError.value || productError.value))

const supplierOptions = computed(() => suppliers.value?.results.filter(p => p.active !== false).map(p => ({
  label: p.commercial_name || p.name.join(' '),
  description: p.rfc_id || p.identification || undefined,
  rfc: p.rfc_id,
  identification: p.identification,
  value: p.id
})) ?? [])
const productsById = computed(() => new Map(products.value?.results.map(p => [p.id, p]) ?? []))

const money = computed(() => new Intl.NumberFormat('es-MX', { style: 'currency', currency: draft.currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const lineTotal = (item: PurchaseDraft['items'][number]) => new Decimal(item.quantity || 0).mul(item.unitCost || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
const total = computed(() => draft.items.reduce((s, i) => s.plus(lineTotal(i)), new Decimal(0)).toNumber())
const units = computed(() => draft.items.reduce((s, i) => s.plus(i.quantity || 0), new Decimal(0)).toNumber())

function lineInfo(productId: string) {
  const product = productsById.value.get(productId)
  const snapshot = props.order?.items.find(i => i.productId === productId)
  const unit = typeof product?.unit === 'string' ? product.unit : product?.unit?.name || product?.unit?.code
  return { name: product?.name || snapshot?.name || 'Producto no disponible', code: product?.code || snapshot?.code || '', unit }
}

const picker = reactive({ productId: '', quantity: 1, unitCost: undefined as number | undefined })
const canAdd = computed(() => Boolean(picker.productId) && picker.quantity > 0 && !props.busy)
function addProduct() {
  if (!canAdd.value) return
  const existing = draft.items.find(i => i.productId === picker.productId)
  if (existing) {
    existing.quantity = new Decimal(existing.quantity || 0).plus(picker.quantity).toNumber()
    if (picker.unitCost) existing.unitCost = picker.unitCost
  } else {
    draft.items.push({ productId: picker.productId, quantity: picker.quantity, unitCost: picker.unitCost ?? 0 })
  }
  picker.productId = ''
  picker.quantity = 1
  picker.unitCost = undefined
}

const missingCost = computed(() => draft.items.some(i => !(i.unitCost > 0) || !(i.quantity > 0)))
const blocker = computed(() => {
  if (catalogError.value) return 'Catálogos de Siigo no disponibles.'
  if (!draft.providerId) return 'Selecciona un proveedor.'
  if (!draft.items.length) return 'Agrega al menos un producto.'
  if (missingCost.value) return 'Captura cantidad y costo de cada partida.'
  return ''
})
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="!blocker && emit('save', draft)">
    <UAlert
      v-if="catalogError"
      color="warning"
      variant="subtle"
      icon="i-lucide-plug-zap"
      title="No se pudieron cargar los catálogos de Siigo"
      description="Recarga la página para continuar."
    />

    <div class="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <UCard>
        <template #header>
          <h2 class="font-semibold text-primary">
            Datos de la compra
          </h2>
        </template>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Proveedor" required class="sm:col-span-2">
            <USelectMenu
              v-model="draft.providerId"
              :items="supplierOptions"
              value-key="value"
              :filter-fields="['label', 'rfc', 'identification']"
              :search-input="{ placeholder: 'Nombre o RFC del proveedor' }"
              :loading="supplierStatus === 'pending'"
              :disabled="busy"
              icon="i-lucide-truck"
              placeholder="Selecciona proveedor"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Fecha" required>
            <PurchasesPurchaseDate v-model="draft.date" />
          </UFormField>
          <UFormField label="Moneda">
            <USelect
              v-model="draft.currencyCode"
              :items="['MXN', 'USD']"
              :disabled="busy"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Notas" class="sm:col-span-2">
            <UTextarea
              v-model="draft.notes"
              :maxlength="2000"
              :rows="3"
              :disabled="busy"
              :ui="{ base: 'resize-none' }"
              placeholder="Condiciones, referencia del proveedor, entrega…"
              class="w-full"
            />
          </UFormField>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold text-primary">
            Agregar producto
          </h2>
        </template>
        <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <UFormField label="Producto" class="min-w-0 sm:col-span-3">
            <ProductsProductSearch
              v-model="picker.productId"
              :products="products?.results ?? []"
              :loading="productStatus === 'pending'"
              :disabled="busy"
              class="w-full min-w-0"
            />
          </UFormField>
          <UFormField label="Cantidad" class="min-w-0">
            <UInputNumber
              v-model="picker.quantity"
              :min="0.000001"
              :step="1"
              :step-snapping="false"
              :format-options="{ maximumFractionDigits: 6 }"
              :disabled="busy"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Costo unitario (con impuestos)" class="min-w-0">
            <UInputNumber
              v-model="picker.unitCost"
              :min="0"
              :step="1"
              :step-snapping="false"
              :format-options="{ maximumFractionDigits: 6 }"
              :increment="false"
              :decrement="false"
              :disabled="busy"
              placeholder="0.00"
              class="w-full"
            />
          </UFormField>
          <div class="flex items-end">
            <UButton
              label="Agregar"
              icon="i-lucide-plus"
              class="w-full justify-center"
              :disabled="!canAdd"
              @click="addProduct"
            />
          </div>
        </div>
      </UCard>
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="font-semibold text-primary">
              Partidas
            </h2>
            <p class="mt-1 text-sm text-muted">
              {{ draft.items.length }} {{ draft.items.length === 1 ? 'producto' : 'productos' }}
            </p>
          </div>
          <p class="text-right text-sm text-muted">
            Total
            <span class="ms-2 text-base font-semibold text-primary tabular-nums">{{ money.format(total) }}</span>
          </p>
        </div>
      </template>

      <div v-if="!draft.items.length" class="flex flex-col items-center gap-2 px-4 py-12 text-center">
        <UIcon name="i-lucide-package-plus" class="size-8 text-dimmed" />
        <p class="font-medium">
          Sin partidas
        </p>
        <p class="text-sm text-muted">
          Busca un producto arriba para agregarlo a la compra.
        </p>
      </div>

      <div v-else>
        <div class="hidden gap-3 border-b border-default bg-elevated/50 px-4 py-2 text-xs font-medium text-muted uppercase md:grid md:grid-cols-[minmax(0,1fr)_9rem_11rem_8rem_2.25rem]">
          <span>Producto</span><span>Cantidad</span><span>Costo unitario</span><span class="text-right">Importe</span><span class="sr-only">Acciones</span>
        </div>
        <ul class="divide-y divide-default">
          <li
            v-for="(item, index) in draft.items"
            :key="item.productId"
            class="grid grid-cols-2 items-center gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_9rem_11rem_8rem_2.25rem]"
          >
            <div class="col-span-2 flex min-w-0 items-start justify-between gap-2 md:col-span-1">
              <div class="min-w-0">
                <p class="truncate font-medium">
                  {{ lineInfo(item.productId).name }}
                </p>
                <p class="text-sm text-muted">
                  <span v-if="lineInfo(item.productId).code">{{ lineInfo(item.productId).code }}</span>
                  <span v-if="lineInfo(item.productId).unit"> · {{ lineInfo(item.productId).unit }}</span>
                </p>
              </div>
              <UButton
                icon="i-lucide-trash-2"
                aria-label="Quitar partida"
                color="neutral"
                variant="ghost"
                class="md:hidden"
                :disabled="busy"
                @click="draft.items.splice(index, 1)"
              />
            </div>
            <UFormField label="Cantidad" :ui="{ label: 'md:sr-only' }">
              <UInputNumber
                v-model="item.quantity"
                :min="0.000001"
                :step="1"
                :step-snapping="false"
                :format-options="{ maximumFractionDigits: 6 }"
                :disabled="busy"
                size="sm"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Costo unitario" :ui="{ label: 'md:sr-only' }">
              <UInputNumber
                v-model="item.unitCost"
                :min="0"
                :step="1"
                :step-snapping="false"
                :format-options="{ maximumFractionDigits: 6 }"
                :increment="false"
                :decrement="false"
                :color="item.unitCost > 0 ? 'primary' : 'error'"
                :highlight="!(item.unitCost > 0)"
                :disabled="busy"
                size="sm"
                class="w-full"
              />
            </UFormField>
            <p class="col-span-2 flex justify-between text-sm md:col-span-1 md:block md:text-right">
              <span class="text-muted md:hidden">Importe</span>
              <span class="font-medium tabular-nums">{{ money.format(lineTotal(item).toNumber()) }}</span>
            </p>
            <UButton
              icon="i-lucide-trash-2"
              aria-label="Quitar partida"
              color="neutral"
              variant="ghost"
              class="hidden md:inline-flex"
              :disabled="busy"
              @click="draft.items.splice(index, 1)"
            />
          </li>
        </ul>
      </div>

      <template v-if="draft.items.length" #footer>
        <div class="flex flex-col gap-2 sm:ms-auto sm:max-w-sm">
          <div class="flex items-center justify-between gap-4 text-sm">
            <span class="text-muted">Unidades</span>
            <span class="tabular-nums">{{ units.toLocaleString('es-MX', { maximumFractionDigits: 6 }) }}</span>
          </div>
          <div class="flex items-center justify-between gap-4 border-t border-default pt-2">
            <span class="font-semibold text-primary">Total ({{ draft.currencyCode }})</span>
            <span class="text-lg font-semibold text-primary tabular-nums">{{ money.format(total) }}</span>
          </div>
        </div>
      </template>
    </UCard>

    <div class="flex flex-col-reverse gap-3 border-t border-default pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-sm" :class="blocker ? 'text-warning' : 'text-muted'">
        {{ blocker || 'El borrador se puede editar hasta confirmar la orden.' }}
      </p>
      <div class="flex flex-col gap-2 sm:flex-row">
        <UButton
          v-if="cancelTo"
          :to="cancelTo"
          label="Cancelar"
          icon="i-lucide-x"
          color="neutral"
          variant="outline"
          class="justify-center"
          :disabled="busy"
        />
        <UButton
          type="submit"
          :label="order ? 'Guardar cambios' : 'Guardar borrador'"
          icon="i-lucide-save"
          class="justify-center"
          :loading="busy"
          :disabled="Boolean(blocker)"
        />
      </div>
    </div>
  </form>
</template>
