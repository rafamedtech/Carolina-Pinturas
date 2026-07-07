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
  cell: ({ row }) => row.original.observations
    ? h('span', { class: 'text-sm' }, row.original.observations)
    : h('span', { class: 'text-muted' }, '—')
}, {
  accessorKey: 'quantity',
  header: () => h('div', { class: 'text-right' }, 'Cantidad'),
  cell: ({ row }) => h('div', { class: 'text-right' }, String(row.original.quantity))
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
      <h2 class="font-semibold text-highlighted">
        Partidas
      </h2>
    </template>

    <UTable
      :data="tableItems"
      :columns="columns"
      empty="El pedido no tiene partidas."
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
              :min="0.000001"
              :step="1"
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
