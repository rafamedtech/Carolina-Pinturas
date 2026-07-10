<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import OrderLineCards from './OrderLineCards.vue'
import type { DraftOrderLine } from '~/composables/useOrderDraft'
import { draftLineTotal } from '~/composables/useOrderDraft'
import type { OrderDiscountType } from '~/types/orders'
import { DISCOUNT_TYPE_OPTIONS } from '~/utils/orderDiscount'

const props = defineProps<{
  lines: readonly DraftOrderLine[]
  total: number
  discountType: OrderDiscountType
  discountValue: number
  discountAmount: number
  grandTotal: number
  quoteMode?: boolean
  editablePrices?: boolean
}>()

const emit = defineEmits<{
  'remove': [productId: string]
  'observations': [productId: string, value: string]
  'quantity': [productId: string, value: number]
  'price': [productId: string, unitPrice: number, note: string]
  'discount': [productId: string, type: OrderDiscountType, value: number]
  'update:discountType': [value: OrderDiscountType]
  'update:discountValue': [value: number]
}>()

const UButton = resolveComponent('UButton')
const UInput = resolveComponent('UInput')
const UInputNumber = resolveComponent('UInputNumber')
const USelect = resolveComponent('USelect')
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const tableLines = computed(() => [...props.lines])

function updateObservations(productId: string, value: string) {
  emit('observations', productId, value)
}

function updateQuantity(productId: string, value: number) {
  emit('quantity', productId, value)
}

function updateDiscount(productId: string, type: OrderDiscountType, value: number) {
  emit('discount', productId, type, value)
}

const priceModalOpen = shallowRef(false)
const editingLine = shallowRef<DraftOrderLine | null>(null)
const editPrice = shallowRef(0)
const editNote = shallowRef('')

function openPriceEdit(line: DraftOrderLine) {
  editingLine.value = line
  editPrice.value = line.unitPrice
  editNote.value = line.priceNote
  priceModalOpen.value = true
}

const canSavePrice = computed(() =>
  Number.isFinite(editPrice.value) && editPrice.value > 0)

function submitPriceEdit() {
  if (!editingLine.value || !canSavePrice.value) return
  emit('price', editingLine.value.productId, editPrice.value, editNote.value.trim())
  priceModalOpen.value = false
}

const columns: TableColumn<DraftOrderLine>[] = [{
  accessorKey: 'code',
  header: 'Código'
}, {
  accessorKey: 'name',
  header: 'Producto'
}, {
  id: 'unit',
  header: 'Unidad',
  cell: ({ row }) => row.original.unit.name || row.original.unit.code || '—'
}, {
  accessorKey: 'observations',
  header: 'Observaciones',
  cell: ({ row }) => h(UInput, {
    'modelValue': row.original.observations,
    'placeholder': 'Observaciones…',
    'size': 'sm',
    'variant': 'subtle',
    'aria-label': `Observaciones de ${row.original.name}`,
    'onUpdate:modelValue': (value: string) => emit('observations', row.original.productId, value)
  })
}, {
  accessorKey: 'quantity',
  header: () => h('div', { class: 'text-right' }, 'Cantidad'),
  cell: ({ row }) => h(UInputNumber, {
    'modelValue': row.original.quantity,
    'min': 0.01,
    'step': 1,
    'stepSnapping': false,
    'formatOptions': { maximumFractionDigits: 2 },
    'size': 'sm',
    'variant': 'subtle',
    'class': 'ms-auto w-28',
    'aria-label': `Cantidad de ${row.original.name}`,
    'onUpdate:modelValue': (value: number) => emit('quantity', row.original.productId, value)
  })
}, {
  accessorKey: 'unitPrice',
  header: () => h('div', { class: 'text-right' }, 'Precio unitario'),
  cell: ({ row }) => h('div', { class: 'flex items-center justify-end gap-1' }, [
    h('span', currency.format(row.original.unitPrice)),
    props.editablePrices
      ? h(UButton, {
          'icon': 'i-lucide-pencil',
          'color': 'neutral',
          'variant': 'ghost',
          'size': 'xs',
          'aria-label': `Editar precio de ${row.original.name}`,
          'onClick': () => openPriceEdit(row.original)
        })
      : null
  ])
}, {
  id: 'discount',
  header: () => h('div', { class: 'text-right' }, 'Descuento'),
  cell: ({ row }) => h('div', { class: 'flex items-center justify-end gap-1' }, [
    h(USelect, {
      'modelValue': row.original.discountType,
      'items': DISCOUNT_TYPE_OPTIONS,
      'size': 'sm',
      'variant': 'subtle',
      'class': 'w-16',
      'aria-label': `Tipo de descuento de ${row.original.name}`,
      'onUpdate:modelValue': (value: OrderDiscountType) =>
        emit('discount', row.original.productId, value, row.original.discountValue)
    }),
    h(UInputNumber, {
      'modelValue': row.original.discountValue,
      'min': 0,
      'max': row.original.discountType === 'porcentaje' ? 100 : undefined,
      'step': 1,
      'size': 'sm',
      'variant': 'subtle',
      'class': 'w-24',
      'aria-label': `Descuento de ${row.original.name}`,
      'onUpdate:modelValue': (value: number) =>
        emit('discount', row.original.productId, row.original.discountType, value)
    })
  ])
}, {
  id: 'total',
  header: () => h('div', { class: 'text-right' }, 'Importe'),
  cell: ({ row }) => h('div', { class: 'text-right font-medium' }, currency.format(draftLineTotal(row.original)))
}, {
  id: 'actions',
  header: '',
  cell: ({ row }) => h(UButton, {
    'icon': 'i-lucide-trash-2',
    'color': 'neutral',
    'variant': 'ghost',
    'aria-label': `Quitar ${row.original.name}`,
    'onClick': () => emit('remove', row.original.productId)
  })
}]
</script>

<template>
  <UCard class="shrink-0" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold text-primary">
            {{ props.quoteMode ? 'Partidas de la cotización' : 'Partidas del pedido' }}
          </h2>
          <p class="mt-1 text-sm text-muted">
            {{ lines.length }} {{ lines.length === 1 ? 'producto agregado' : 'productos agregados' }}
          </p>
        </div>
        <p class="text-right text-sm text-muted">
          Total
          <span class="ms-2 text-base font-semibold text-primary">{{ currency.format(grandTotal) }}</span>
        </p>
      </div>
    </template>

    <OrderLineCards
      :lines="lines"
      :quote-mode="props.quoteMode"
      :editable-prices="props.editablePrices"
      @remove="emit('remove', $event)"
      @observations="updateObservations"
      @quantity="updateQuantity"
      @discount="updateDiscount"
      @edit-price="openPriceEdit"
    />

    <UTable
      :data="tableLines"
      :columns="columns"
      :empty="`Agrega productos para iniciar ${props.quoteMode ? 'la cotización' : 'el pedido'}.`"
      class="hidden md:block"
      :ui="{
        base: 'table-fixed border-separate border-spacing-0',
        thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
        tbody: '[&>tr]:last:[&>td]:border-b-0',
        th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
        td: 'border-b border-default',
        separator: 'h-0'
      }"
    />

    <template #footer>
      <div class="flex flex-col gap-3 sm:ms-auto sm:max-w-sm">
        <div class="flex items-center justify-between gap-4">
          <span class="text-sm text-muted">Suma de partidas</span>
          <span class="font-medium">{{ currency.format(total) }}</span>
        </div>
        <div class="flex items-center justify-between gap-4">
          <label class="text-sm text-muted" for="order-discount-value">
            {{ props.quoteMode ? 'Descuento a la cotización' : 'Descuento al pedido' }}
          </label>
          <div class="flex items-center gap-1">
            <USelect
              :model-value="discountType"
              :items="DISCOUNT_TYPE_OPTIONS"
              size="sm"
              variant="subtle"
              class="w-16"
              :aria-label="`Tipo de descuento ${props.quoteMode ? 'de la cotización' : 'del pedido'}`"
              @update:model-value="emit('update:discountType', $event as OrderDiscountType)"
            />
            <UInputNumber
              id="order-discount-value"
              :model-value="discountValue"
              :min="0"
              :max="discountType === 'porcentaje' ? 100 : undefined"
              :step="1"
              size="sm"
              variant="subtle"
              class="w-28"
              @update:model-value="emit('update:discountValue', $event)"
            />
          </div>
        </div>
        <div v-if="discountAmount > 0" class="flex items-center justify-between gap-4 text-sm">
          <span class="text-muted">Descuento aplicado</span>
          <span class="font-medium text-error">-{{ currency.format(discountAmount) }}</span>
        </div>
        <div class="flex items-center justify-between gap-4 border-t border-default pt-3">
          <span class="font-semibold text-primary">Total</span>
          <span class="text-lg font-semibold text-primary">{{ currency.format(grandTotal) }}</span>
        </div>
      </div>
    </template>

    <UModal v-model:open="priceModalOpen" title="Editar precio">
      <template #body>
        <div v-if="editingLine" class="space-y-4">
          <div>
            <p class="text-sm text-muted">
              Producto
            </p>
            <p class="font-medium">
              {{ editingLine.name }}
            </p>
            <p class="text-sm text-muted">
              Precio actual: {{ currency.format(editingLine.unitPrice) }}
            </p>
            <p v-if="editingLine.unitPrice !== editingLine.catalogPrice" class="text-sm text-muted">
              Precio de lista: {{ currency.format(editingLine.catalogPrice) }}
            </p>
          </div>

          <UFormField label="Precio nuevo">
            <UInputNumber
              v-model="editPrice"
              :min="0.01"
              :step="1"
              :step-snapping="false"
              :format-options="{ maximumFractionDigits: 2 }"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Motivo del cambio (opcional)">
            <UTextarea
              v-model="editNote"
              placeholder="Ej. ajuste por promoción, corrección de captura…"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="priceModalOpen = false"
          />
          <UButton
            label="Guardar"
            :disabled="!canSavePrice"
            @click="submitPriceEdit"
          />
        </div>
      </template>
    </UModal>
  </UCard>
</template>
