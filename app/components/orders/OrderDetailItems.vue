<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { SalesOrderDetail, SalesOrderItem } from '~/types/orders'

const props = defineProps<{
  items: readonly SalesOrderItem[]
  currencyCode: string
  orderId: string
  version: number
  editable?: boolean
}>()

const emit = defineEmits<{
  updated: [order: SalesOrderDetail]
}>()

const UButton = resolveComponent('UButton')
const toast = useToast()

const currency = computed(() => new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: props.currencyCode
}))

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
  editingItem.value = item
  editPrice.value = item.unitPrice
  editNote.value = ''
  priceError.value = ''
  editOpen.value = true
}

async function submitPriceEdit() {
  if (!editingItem.value || savingPrice.value) return
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
  if (!quantityEditingItem.value || !canSaveQuantity.value || savingQuantity.value) return
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short'
  })
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
  header: () => h('div', { class: 'text-right' }, 'Cantidad'),
  cell: ({ row }) => h('div', { class: 'flex items-center justify-end gap-1' }, [
    h('span', String(row.original.quantity)),
    props.editable
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
  header: 'Unidad',
  cell: ({ row }) => row.original.unit.name || row.original.unit.code || '—'
}, {
  accessorKey: 'unitPrice',
  header: () => h('div', { class: 'text-right' }, 'Precio unitario'),
  cell: ({ row }) => h('div', { class: 'flex items-center justify-end gap-1' }, [
    h('span', currency.value.format(row.original.unitPrice)),
    props.editable
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
  header: () => h('div', { class: 'text-right' }, 'Total'),
  cell: ({ row }) => h(
    'div',
    { class: 'text-right font-medium' },
    currency.value.format(row.original.total)
  )
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
      <UCard
        v-for="item in items"
        :key="item.id"
        variant="subtle"
        :ui="{ body: 'flex flex-col gap-4 p-4 sm:p-4' }"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-medium uppercase tracking-wide text-muted">
              {{ item.code }}
            </p>
            <h3 class="font-semibold text-highlighted">
              {{ item.name }}
            </h3>
            <p class="text-sm text-muted">
              Unidad: {{ item.unit.name || item.unit.code || '—' }}
            </p>
          </div>

          <div class="flex shrink-0 items-center gap-1">
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
        </div>

        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p class="text-muted">
              Cantidad
            </p>
            <div class="flex items-center gap-1">
              <p class="font-medium text-highlighted">
                {{ item.quantity }} {{ item.unit.name || item.unit.code || '' }}
              </p>
              <UButton
                v-if="editable"
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="`Editar cantidad de ${item.name}`"
                @click="openQuantityEdit(item)"
              />
            </div>
          </div>
          <div class="text-right">
            <p class="text-muted">
              Precio unitario
            </p>
            <div class="flex items-center justify-end gap-1">
              <p class="font-medium text-highlighted">
                {{ currency.format(item.unitPrice) }}
              </p>
              <UButton
                v-if="editable"
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="`Editar precio de ${item.name}`"
                @click="openEdit(item)"
              />
            </div>
          </div>
        </div>

        <div v-if="item.observations || editable">
          <p class="text-sm text-muted">
            Observaciones
          </p>
          <div class="flex items-start gap-1">
            <p :class="item.observations ? 'whitespace-pre-wrap text-sm' : 'text-sm text-muted'">
              {{ item.observations || '—' }}
            </p>
            <UButton
              v-if="editable"
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="`Editar observaciones de ${item.name}`"
              @click="openObservationsEdit(item)"
            />
          </div>
        </div>

        <div class="flex items-end justify-between gap-4 border-t border-default pt-3">
          <span class="text-sm text-muted">Total</span>
          <span class="text-base font-semibold text-highlighted">
            {{ currency.format(item.total) }}
          </span>
        </div>
      </UCard>

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

    <UTable
      :data="tableItems"
      :columns="columns"
      empty="El pedido no tiene partidas."
      class="hidden md:block"
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
