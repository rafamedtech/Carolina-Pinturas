<script setup lang="ts">
import { createCurrencyFormatter } from '@rafamedtech/nuxt-shared/utils'
import { formatDateTime } from '~/utils/datetime'
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { SalesOrderDetail, SalesOrderItem } from '~/types/orders'

const props = withDefaults(defineProps<{
  items: readonly SalesOrderItem[]
  currencyCode: string
  orderId: string
  version: number
  editable?: boolean
  deletable?: boolean
  inventoryDispatched?: boolean
  amountsEditable?: boolean
  quantityEditable?: boolean
}>(), { amountsEditable: true, quantityEditable: true, inventoryDispatched: false })

const emit = defineEmits<{
  updated: [order: SalesOrderDetail]
  deleted: [itemId: string]
}>()

const UButton = resolveComponent('UButton')
const toast = useToast()

const currency = computed(() => createCurrencyFormatter(props.currencyCode))

const deleteOpen = shallowRef(false)
const deletingItem = shallowRef<SalesOrderItem | null>(null)

function openDelete(item: SalesOrderItem) {
  if (!props.deletable || props.items.length <= 1) return
  deletingItem.value = item
  deleteOpen.value = true
}

const editOpen = shallowRef(false)
const editingItem = shallowRef<SalesOrderItem | null>(null)
const editPrice = shallowRef(0)
const editNote = shallowRef('')
const savingPrice = shallowRef(false)
const priceError = shallowRef('')
const quantityEditOpen = shallowRef(false)
const quantityEditingItem = shallowRef<SalesOrderItem | null>(null)
const editQuantity = shallowRef(0)
const savingQuantity = shallowRef(false)
const quantityError = shallowRef('')
const observationsEditOpen = shallowRef(false)
const observationsEditingItem = shallowRef<SalesOrderItem | null>(null)
const editObservations = shallowRef('')
const savingObservations = shallowRef(false)
const observationsError = shallowRef('')

function openEdit(item: SalesOrderItem) {
  if (!props.editable || !props.amountsEditable) return
  editingItem.value = item
  editPrice.value = item.unitPrice
  editNote.value = ''
  priceError.value = ''
  editOpen.value = true
}

async function submitPriceEdit() {
  if (!props.editable || !props.amountsEditable || !editingItem.value || savingPrice.value) return
  savingPrice.value = true
  priceError.value = ''

  try {
    const updated = await $fetch<SalesOrderDetail>(
      `/api/orders/${encodeURIComponent(props.orderId)}/items/${encodeURIComponent(editingItem.value.id)}/precio`,
      {
        method: 'PATCH',
        body: {
          unitPrice: editPrice.value,
          note: editNote.value || null,
          version: props.version
        }
      }
    )
    emit('updated', updated)
    editOpen.value = false
    toast.add({
      title: 'Precio actualizado',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (fetchError: unknown) {
    const response = fetchError as { data?: { statusMessage?: string }, message?: string }
    priceError.value = response.data?.statusMessage || response.message || 'No se pudo actualizar el precio.'
  } finally {
    savingPrice.value = false
  }
}

function openQuantityEdit(item: SalesOrderItem) {
  if (!props.editable || !props.amountsEditable || !props.quantityEditable) return
  quantityEditingItem.value = item
  editQuantity.value = item.quantity
  quantityError.value = ''
  quantityEditOpen.value = true
}

const canSaveQuantity = computed(() =>
  Boolean(
    quantityEditingItem.value
    && Number.isFinite(editQuantity.value)
    && editQuantity.value > 0
    && editQuantity.value !== quantityEditingItem.value.quantity
  )
)

async function submitQuantityEdit() {
  if (!props.editable || !props.amountsEditable || !props.quantityEditable || !quantityEditingItem.value || !canSaveQuantity.value || savingQuantity.value) return
  savingQuantity.value = true
  quantityError.value = ''

  try {
    const updated = await $fetch<SalesOrderDetail>(
      `/api/orders/${encodeURIComponent(props.orderId)}/items/${encodeURIComponent(quantityEditingItem.value.id)}/cantidad`,
      {
        method: 'PATCH',
        body: {
          quantity: editQuantity.value,
          version: props.version
        }
      }
    )
    emit('updated', updated)
    quantityEditOpen.value = false
    toast.add({
      title: 'Cantidad actualizada',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (fetchError: unknown) {
    const response = fetchError as { data?: { statusMessage?: string }, message?: string }
    quantityError.value = response.data?.statusMessage || response.message || 'No se pudo actualizar la cantidad.'
  } finally {
    savingQuantity.value = false
  }
}

function openObservationsEdit(item: SalesOrderItem) {
  observationsEditingItem.value = item
  editObservations.value = item.observations || ''
  observationsError.value = ''
  observationsEditOpen.value = true
}

const canSaveObservations = computed(() =>
  Boolean(
    observationsEditingItem.value
    && editObservations.value.trim() !== (observationsEditingItem.value.observations || '').trim()
    && editObservations.value.trim().length <= 5000
  )
)

async function submitObservationsEdit() {
  if (!observationsEditingItem.value || !canSaveObservations.value || savingObservations.value) return
  savingObservations.value = true
  observationsError.value = ''

  try {
    const updated = await $fetch<SalesOrderDetail>(
      `/api/orders/${encodeURIComponent(props.orderId)}/items/${encodeURIComponent(observationsEditingItem.value.id)}/observaciones`,
      {
        method: 'PATCH',
        body: {
          observations: editObservations.value.trim() || null,
          version: props.version
        }
      }
    )
    emit('updated', updated)
    observationsEditOpen.value = false
    toast.add({
      title: 'Observaciones actualizadas',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (fetchError: unknown) {
    const response = fetchError as { data?: { statusMessage?: string }, message?: string }
    observationsError.value = response.data?.statusMessage || response.message || 'No se pudieron actualizar las observaciones.'
  } finally {
    savingObservations.value = false
  }
}

const historyOpen = shallowRef(false)
const historyItem = shallowRef<SalesOrderItem | null>(null)

function openHistory(item: SalesOrderItem) {
  historyItem.value = item
  historyOpen.value = true
}

const tableItems = computed(() => [...props.items])
const columns: TableColumn<SalesOrderItem>[] = [{
  accessorKey: 'code',
  header: 'Código'
}, {
  accessorKey: 'name',
  header: 'Producto'
}, {
  accessorKey: 'observations',
  header: 'Observaciones',
  cell: ({ row }) => h('div', { class: 'flex items-start gap-1' }, [
    h(
      'span',
      { class: row.original.observations ? 'whitespace-pre-wrap text-sm' : 'text-muted' },
      row.original.observations || '—'
    ),
    props.editable
      ? h(UButton, {
          'icon': 'i-lucide-pencil',
          'color': 'neutral',
          'variant': 'ghost',
          'size': 'xs',
          'aria-label': `Editar observaciones de ${row.original.name}`,
          'onClick': () => openObservationsEdit(row.original)
        })
      : null
  ])
}, {
  accessorKey: 'quantity',
  header: 'Cantidad',
  meta: { class: { th: 'text-right' } },
  cell: ({ row }) => h('div', { class: 'flex items-center justify-end gap-1' }, [
    h('span', String(row.original.quantity)),
    props.editable && props.amountsEditable && props.quantityEditable !== false
      ? h(UButton, {
          'icon': 'i-lucide-pencil',
          'color': 'neutral',
          'variant': 'ghost',
          'size': 'xs',
          'aria-label': `Editar cantidad de ${row.original.name}`,
          'onClick': () => openQuantityEdit(row.original)
        })
      : null
  ])
}, {
  id: 'unit',
  accessorFn: row => row.unit.name || row.unit.code,
  header: 'Unidad',
  cell: ({ row }) => row.original.unit.name || row.original.unit.code || '—'
}, {
  accessorKey: 'unitPrice',
  header: 'Precio unitario',
  meta: { class: { th: 'text-right' } },
  cell: ({ row }) => h('div', { class: 'flex items-center justify-end gap-1' }, [
    h('span', currency.value.format(row.original.unitPrice)),
    props.editable && props.amountsEditable
      ? h(UButton, {
          'icon': 'i-lucide-pencil',
          'color': 'neutral',
          'variant': 'ghost',
          'size': 'xs',
          'aria-label': `Editar precio de ${row.original.name}`,
          'onClick': () => openEdit(row.original)
        })
      : null,
    row.original.priceHistory.length
      ? h(UButton, {
          'icon': 'i-lucide-history',
          'color': 'neutral',
          'variant': 'ghost',
          'size': 'xs',
          'aria-label': `Historial de precio de ${row.original.name}`,
          'onClick': () => openHistory(row.original)
        })
      : null
  ])
}, {
  accessorKey: 'total',
  header: 'Total',
  meta: { class: { th: 'text-right' } },
  cell: ({ row }) => h(
    'div',
    { class: 'text-right font-medium text-primary' },
    currency.value.format(row.original.total)
  )
}, {
  id: 'actions',
  header: '',
  cell: ({ row }) => props.deletable
    ? h(UButton, {
        'icon': 'i-lucide-trash-2',
        'color': 'error',
        'variant': 'ghost',
        'size': 'xs',
        'disabled': props.items.length <= 1,
        'title': props.items.length <= 1 ? 'El pedido debe conservar al menos una partida.' : 'Eliminar partida',
        'aria-label': `Eliminar partida de ${row.original.name}`,
        'onClick': () => openDelete(row.original)
      })
    : null
}]
</script>

<template>
  <UCard class="shrink-0" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <h2 class="font-semibold text-primary">
        Partidas
      </h2>
    </template>

    <div class="flex flex-col gap-3 p-4 md:hidden">
      <ListRecordCard
        v-for="item in items"
        :key="item.id"
        :title="item.name"
        :eyebrow="item.code"
        :fields="[
          { key: 'quantity', label: 'Cantidad', value: `${item.quantity} ${item.unit.name || item.unit.code || ''}` },
          { key: 'price', label: 'Precio unitario', value: currency.format(item.unitPrice) },
          ...(item.observations || editable ? [{ key: 'observations', label: 'Observaciones', value: item.observations, fullWidth: true }] : [])
        ]"
        summary-label="Total"
        :summary-value="currency.format(item.total)"
        summary-color="primary"
      >
        <template #title-extra>
          <OrdersOrderItemComposition :item="item" />
        </template>
        <template v-if="deletable || item.priceHistory.length" #actions>
          <div class="flex items-center gap-1">
            <UButton
              v-if="deletable"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              :disabled="items.length <= 1"
              :title="items.length <= 1 ? 'El pedido debe conservar al menos una partida.' : 'Eliminar partida'"
              :aria-label="`Eliminar partida de ${item.name}`"
              @click="openDelete(item)"
            />
            <UButton
              v-if="item.priceHistory.length"
              icon="i-lucide-history"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="`Historial de precio de ${item.name}`"
              @click="openHistory(item)"
            />
          </div>
        </template>
        <template #field-value="{ field }">
          <div class="flex items-start gap-1">
            <span class="min-w-0 whitespace-pre-wrap wrap-anywhere">{{ field.value || '—' }}</span>
            <AppButton
              v-if="field.key === 'quantity' && editable && amountsEditable && quantityEditable !== false"
              icon="i-lucide-pencil"
              intent="quiet"
              size="xs"
              :aria-label="`Editar cantidad de ${item.name}`"
              @click="openQuantityEdit(item)"
            />
            <AppButton
              v-if="field.key === 'price' && editable && amountsEditable"
              icon="i-lucide-pencil"
              intent="quiet"
              size="xs"
              :aria-label="`Editar precio de ${item.name}`"
              @click="openEdit(item)"
            />
            <AppButton
              v-if="field.key === 'observations' && editable"
              icon="i-lucide-pencil"
              intent="quiet"
              size="xs"
              :aria-label="`Editar observaciones de ${item.name}`"
              @click="openObservationsEdit(item)"
            />
          </div>
        </template>
      </ListRecordCard>

      <div
        v-if="items.length === 0"
        class="flex flex-col items-center gap-2 rounded-lg border border-default bg-elevated/50 px-4 py-10 text-center"
      >
        <UIcon name="i-lucide-shopping-cart" class="size-8 text-muted" />
        <p class="text-sm text-muted">
          El pedido no tiene partidas.
        </p>
      </div>
    </div>

    <DetailTable
      :data="tableItems"
      :get-row-id="row => row.id"
      :columns="columns"
      empty="El pedido no tiene partidas."
      class="hidden md:block"
    >
      <template #name-cell="{ row }">
        <div class="flex items-center gap-1">
          <span>{{ row.original.name }}</span>
          <OrdersOrderItemComposition :item="row.original" />
        </div>
      </template>
    </DetailTable>

    <OrdersOrderItemDeleteModal
      v-if="deletable && deletingItem"
      v-model:open="deleteOpen"
      :order-id="orderId"
      :item="deletingItem"
      :version="version"
      :inventory-dispatched="inventoryDispatched"
      @deleted="emit('deleted', $event)"
    />

    <UModal v-model:open="editOpen" title="Editar precio">
      <template #body>
        <div v-if="editingItem" class="space-y-4">
          <div>
            <p class="text-sm text-muted">
              Producto
            </p>
            <p class="font-medium">
              {{ editingItem.name }}
            </p>
            <p class="text-sm text-muted">
              Precio actual: {{ currency.format(editingItem.unitPrice) }}
            </p>
          </div>

          <UFormField label="Precio nuevo">
            <UInputNumber
              v-model="editPrice"
              :min="0.01"
              :step="0.01"
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

          <UAlert
            v-if="priceError"
            color="error"
            variant="subtle"
            :description="priceError"
            icon="i-lucide-circle-alert"
          />
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            :disabled="savingPrice"
            @click="editOpen = false"
          />
          <UButton
            label="Guardar"
            :loading="savingPrice"
            @click="submitPriceEdit"
          />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="observationsEditOpen" title="Editar observaciones">
      <template #body>
        <div v-if="observationsEditingItem" class="space-y-4">
          <div>
            <p class="text-sm text-muted">
              Producto
            </p>
            <p class="font-medium">
              {{ observationsEditingItem.name }}
            </p>
          </div>

          <UFormField label="Observaciones nuevas">
            <UTextarea
              v-model="editObservations"
              :maxlength="5000"
              :rows="5"
              placeholder="Agrega indicaciones para esta partida…"
              class="w-full"
            />
          </UFormField>

          <UAlert
            v-if="observationsError"
            color="error"
            variant="subtle"
            :description="observationsError"
            icon="i-lucide-circle-alert"
          />
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            :disabled="savingObservations"
            @click="observationsEditOpen = false"
          />
          <UButton
            label="Guardar"
            :loading="savingObservations"
            :disabled="!canSaveObservations"
            @click="submitObservationsEdit"
          />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="quantityEditOpen" title="Editar cantidad">
      <template #body>
        <div v-if="quantityEditingItem" class="space-y-4">
          <div>
            <p class="text-sm text-muted">
              Producto
            </p>
            <p class="font-medium">
              {{ quantityEditingItem.name }}
            </p>
            <p class="text-sm text-muted">
              Cantidad actual: {{ quantityEditingItem.quantity }} {{ quantityEditingItem.unit.name || quantityEditingItem.unit.code || '' }}
            </p>
          </div>

          <UFormField label="Cantidad nueva">
            <UInputNumber
              v-model="editQuantity"
              :min="0.000001"
              :max="1000000"
              :step="1"
              :step-snapping="false"
              :format-options="{ maximumFractionDigits: 6 }"
              class="w-full"
            />
          </UFormField>

          <UAlert
            v-if="quantityError"
            color="error"
            variant="subtle"
            :description="quantityError"
            icon="i-lucide-circle-alert"
          />
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            :disabled="savingQuantity"
            @click="quantityEditOpen = false"
          />
          <UButton
            label="Guardar"
            :loading="savingQuantity"
            :disabled="!canSaveQuantity"
            @click="submitQuantityEdit"
          />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="historyOpen" title="Historial de precio">
      <template #body>
        <div v-if="historyItem" class="space-y-4">
          <p class="font-medium">
            {{ historyItem.name }}
          </p>
          <ul class="divide-y divide-default rounded-lg border border-default">
            <li
              v-for="entry in [...historyItem.priceHistory].reverse()"
              :key="entry.id"
              class="flex flex-col gap-1 px-3 py-2 text-sm"
            >
              <div class="flex items-center justify-between gap-4">
                <span class="font-medium">
                  {{ currency.format(entry.previousPrice) }} → {{ currency.format(entry.newPrice) }}
                </span>
                <span class="text-muted">{{ formatDateTime(entry.changedAt) }}</span>
              </div>
              <p class="text-muted">
                {{ entry.changedBy.name }}
              </p>
              <p v-if="entry.note" class="whitespace-pre-wrap">
                {{ entry.note }}
              </p>
            </li>
          </ul>
        </div>
      </template>
    </UModal>
  </UCard>
</template>
