<script setup lang="ts">
import type { OrderStatus, SalesOrderDetail } from '~/types/orders'
import {
  canCreateOrders,
  canManageOrderLogistics,
  editableOrderStatusKeys
} from '~/utils/roleAccess'
import {
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
  paymentStatusColor,
  paymentStatusLabel,
  paymentMethodLabel
} from '~/utils/orderPayment'

const props = defineProps<{
  orderId: string
}>()

const selectedStatus = shallowRef('')
const statusNote = shallowRef('')
const savingStatus = shallowRef(false)
const selectedRepartidor = shallowRef('')
const savingRepartidor = shallowRef(false)
const selectedPaymentStatus = shallowRef('')
const selectedPaymentMethod = shallowRef('')
const savingPayment = shallowRef(false)
const toast = useToast()
const { user } = useAuth()
const {
  data: order,
  status,
  error,
  refresh
} = useFetch<SalesOrderDetail>(
  () => `/api/orders/${encodeURIComponent(props.orderId)}`,
  { key: `sales-order-${props.orderId}`, lazy: true }
)
const { data: statuses } = useFetch<OrderStatus[]>('/api/orders/statuses', {
  key: 'order-statuses',
  lazy: true,
  default: () => []
})
const { data: repartidores } = useRepartidoresCatalog()

watch(() => order.value?.status.key, (value) => {
  selectedStatus.value = value || ''
}, { immediate: true })

watch(() => order.value?.repartidor?.id, (value) => {
  selectedRepartidor.value = value || ''
}, { immediate: true })

watch(() => order.value?.paymentStatus, (value) => {
  selectedPaymentStatus.value = value || ''
}, { immediate: true })

watch(() => order.value?.paymentMethod, (value) => {
  selectedPaymentMethod.value = value || ''
}, { immediate: true })

const repartidorUnchanged = computed(() => selectedRepartidor.value === (order.value?.repartidor?.id || ''))
const statusUnchanged = computed(() => selectedStatus.value === (order.value?.status.key || ''))
const paymentUnchanged = computed(() =>
  selectedPaymentStatus.value === (order.value?.paymentStatus || '')
  && selectedPaymentMethod.value === (order.value?.paymentMethod || '')
)

// A borrador order is a quotation document; once it advances to ingresado /
// confirmado (or later) it becomes a regular order with delivery logistics.
const isQuote = computed(() => order.value?.status.key === 'borrador')
const documentLabel = computed(() => isQuote.value ? 'Cotización' : 'Pedido')
const detailTitle = computed(() => isQuote.value ? 'Detalle de la cotización' : 'Detalle del pedido')

// The document opens in a clean new tab (no controls); ?action triggers print /
// pdf there so those actions live here, not on the client-facing document.
function openCotizacion(action?: 'print' | 'pdf') {
  const query = action ? `?action=${action}` : ''
  window.open(`/ventas/${props.orderId}/cotizacion${query}`, '_blank', 'noopener')
}
const { printTicket, openTicketPreview } = useTicketPrinter()
const printerSettingsOpen = shallowRef(false)
const documentOptions = computed(() => {
  const groups = [[
    { label: 'Ver documento', icon: 'i-lucide-eye', onSelect: () => openCotizacion() },
    { label: 'Imprimir', icon: 'i-lucide-printer', onSelect: () => openCotizacion('print') },
    { label: 'Descargar PDF', icon: 'i-lucide-download', onSelect: () => openCotizacion('pdf') }
  ]]

  if (!isQuote.value) {
    groups.push([
      { label: 'Imprimir ticket', icon: 'i-lucide-receipt', onSelect: () => { if (order.value) printTicket(order.value) } },
      { label: 'Ver ticket', icon: 'i-lucide-receipt-text', onSelect: () => openTicketPreview(props.orderId) },
      { label: 'Impresora de tickets…', icon: 'i-lucide-settings-2', onSelect: () => { printerSettingsOpen.value = true } }
    ])
  }

  return groups
})

const mayManageLogistics = computed(() =>
  Boolean(user.value && canManageOrderLogistics(user.value.role))
)
const mayManagePayment = mayManageLogistics
const mayEditQuote = computed(() =>
  Boolean(user.value && canCreateOrders(user.value.role))
)
const availableStatuses = computed(() => {
  if (!user.value) return []

  const editableKeys = editableOrderStatusKeys(user.value.role)
  if (!editableKeys) return statuses.value

  return statuses.value.filter(status =>
    status.key === order.value?.status.key || editableKeys.includes(status.key)
  )
})
const backPath = computed(() =>
  user.value?.role === 'igualaciones' ? '/igualaciones' : '/ventas'
)
const savingChanges = computed(() =>
  savingRepartidor.value || savingPayment.value || savingStatus.value
)
const hasChanges = computed(() =>
  (mayManageLogistics.value && !repartidorUnchanged.value)
  || (mayManagePayment.value && !paymentUnchanged.value)
  || !statusUnchanged.value
)

const currency = computed(() => new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: order.value?.currencyCode || 'MXN'
}))
const errorMessage = computed(() =>
  error.value?.data?.statusMessage || 'No fue posible cargar el pedido.'
)

function formatCurrency(value: number | undefined) {
  return currency.value.format(value || 0)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return value.split('-').reverse().join('/')
}

const repartidorOptions = computed(() => repartidores.value.map(repartidor => ({
  label: repartidor.nombre,
  description: repartidor.telefono || undefined,
  value: repartidor.id
})))

const paymentStatusOptions = PAYMENT_STATUSES.map(status => ({
  label: status.label,
  value: status.key as string
}))
const paymentMethodOptions = PAYMENT_METHODS.map(method => ({
  label: method.label,
  value: method.key as string
}))

async function updateRepartidor() {
  if (
    !mayManageLogistics.value
    || !order.value
    || repartidorUnchanged.value
    || !selectedRepartidor.value
  ) return
  savingRepartidor.value = true

  try {
    order.value = await $fetch<SalesOrderDetail>(
      `/api/orders/${encodeURIComponent(props.orderId)}/repartidor`,
      {
        method: 'PATCH',
        body: {
          repartidorId: selectedRepartidor.value,
          version: order.value.version
        }
      }
    )
    toast.add({
      title: 'Repartidor actualizado',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (fetchError: unknown) {
    const response = fetchError as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'No se pudo actualizar el repartidor',
      description: response.data?.statusMessage || response.message || 'Intenta de nuevo.',
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
    await refresh()
  } finally {
    savingRepartidor.value = false
  }
}

async function updatePayment() {
  if (!mayManagePayment.value || !order.value || paymentUnchanged.value) return
  savingPayment.value = true

  try {
    order.value = await $fetch<SalesOrderDetail>(
      `/api/orders/${encodeURIComponent(props.orderId)}/pago`,
      {
        method: 'PATCH',
        body: {
          paymentStatus: selectedPaymentStatus.value,
          paymentMethod: selectedPaymentMethod.value || null,
          version: order.value.version
        }
      }
    )
    toast.add({
      title: 'Pago actualizado',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (fetchError: unknown) {
    const response = fetchError as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'No se pudo actualizar el pago',
      description: response.data?.statusMessage || response.message || 'Intenta de nuevo.',
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
    await refresh()
  } finally {
    savingPayment.value = false
  }
}

async function updateStatus() {
  if (!order.value || selectedStatus.value === order.value.status.key) return
  savingStatus.value = true

  try {
    order.value = await $fetch<SalesOrderDetail>(
      `/api/orders/${encodeURIComponent(props.orderId)}/status`,
      {
        method: 'PATCH',
        body: {
          statusKey: selectedStatus.value,
          note: statusNote.value || null,
          version: order.value.version
        }
      }
    )
    statusNote.value = ''
    toast.add({
      title: 'Estado actualizado',
      description: `El pedido ahora está ${order.value.status.label.toLowerCase()}.`,
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (fetchError: unknown) {
    const response = fetchError as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'No se pudo actualizar el estado',
      description: response.data?.statusMessage || response.message || 'Intenta de nuevo.',
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
    await refresh()
  } finally {
    savingStatus.value = false
  }
}

async function saveChanges() {
  if (!hasChanges.value || savingChanges.value) return

  await updateRepartidor()
  await updatePayment()
  await updateStatus()
}

// A quote is presented to the customer as a clean document; converting it turns
// it into a regular order (ingresado) and brings back the management sections.
const converting = shallowRef(false)
async function convertToPedido() {
  if (!order.value || converting.value) return
  converting.value = true

  try {
    order.value = await $fetch<SalesOrderDetail>(
      `/api/orders/${encodeURIComponent(props.orderId)}/status`,
      {
        method: 'PATCH',
        body: {
          statusKey: 'ingresado',
          note: 'Cotización convertida en pedido.',
          version: order.value.version
        }
      }
    )
    selectedStatus.value = order.value.status.key
    toast.add({
      title: 'Cotización convertida en pedido',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (fetchError: unknown) {
    const response = fetchError as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'No se pudo convertir la cotización',
      description: response.data?.statusMessage || response.message || 'Intenta de nuevo.',
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
    await refresh()
  } finally {
    converting.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="order-detail">
    <template #header>
      <UDashboardNavbar :title="detailTitle">
        <template #leading>
          <UButton
            :to="backPath"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            aria-label="Volver a pedidos"
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
            :loading="status === 'pending'"
            @click="() => refresh()"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="error"
        color="warning"
        variant="subtle"
        title="Pedido no disponible"
        :description="errorMessage"
        icon="i-lucide-database-zap"
      />

      <template v-else-if="order">
        <div
          class="grid grid-cols-2 items-center gap-4 [grid-template-areas:'info_estados'_'acciones_acciones'] lg:grid-cols-[1fr_auto] lg:[grid-template-areas:'info_acciones']"
        >
          <div class="[grid-area:info]">
            <p class="flex items-center gap-1.5 text-sm text-muted">
              <UIcon v-if="isQuote" name="i-lucide-file-text" class="size-4" />
              {{ documentLabel }}
            </p>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-xl font-semibold text-highlighted">
                {{ order.number }}
              </h1>
              <OrdersOrderStatusBadge class="hidden lg:inline-flex" :status="order.status" />
              <UBadge
                v-if="!isQuote"
                class="hidden lg:inline-flex"
                :color="paymentStatusColor(order.paymentStatus)"
                variant="subtle"
                :label="paymentStatusLabel(order.paymentStatus)"
              />
            </div>
            <p class="mt-1 text-sm text-muted">
              {{ formatDate(order.orderDate) }}
            </p>
          </div>
          <div class="[grid-area:estados] flex flex-col items-end gap-2 lg:hidden">
            <OrdersOrderStatusBadge :status="order.status" />
            <UBadge
              v-if="!isQuote"
              :color="paymentStatusColor(order.paymentStatus)"
              variant="subtle"
              :label="paymentStatusLabel(order.paymentStatus)"
            />
          </div>
          <div class="[grid-area:acciones] flex flex-wrap items-center gap-4 lg:justify-end">
            <UDropdownMenu :items="documentOptions">
              <UButton
                label="Opciones"
                icon="i-lucide-settings"
                trailing-icon="i-lucide-chevron-down"
                color="neutral"
                variant="outline"
              />
            </UDropdownMenu>
            <OrdersPrinterSettingsModal v-model:open="printerSettingsOpen" />
            <UButton
              v-if="isQuote && mayEditQuote"
              :to="`/ventas/${order.id}/editar`"
              label="Editar cotización"
              icon="i-lucide-pencil"
              color="neutral"
              variant="outline"
            />
            <UButton
              v-if="isQuote && mayManageLogistics"
              label="Convertir en pedido"
              icon="i-lucide-package-check"
              :loading="converting"
              @click="convertToPedido"
            />
            <UButton
              v-if="!isQuote"
              label="Guardar cambios"
              icon="i-lucide-save"
              :loading="savingChanges"
              :disabled="savingChanges || !hasChanges"
              @click="saveChanges"
            />
          </div>
        </div>

        <div
          class="grid gap-4 [grid-template-areas:'cliente'_'items'_'totales'_'seguimiento'] lg:grid-cols-2 lg:[grid-template-areas:'cliente_seguimiento'_'items_items'_'totales_totales']"
        >
          <UCard class="[grid-area:cliente]">
            <template #header>
              <h2 class="font-semibold text-highlighted">
                {{ isQuote ? 'Cliente' : 'Cliente y entrega' }}
              </h2>
            </template>
            <dl class="grid gap-4 sm:grid-cols-2">
              <div>
                <dt class="text-sm text-muted">
                  Cliente
                </dt>
                <dd class="mt-1 font-medium">
                  {{ order.customer.name }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  RFC
                </dt>
                <dd class="mt-1 font-medium">
                  {{ order.customer.rfc || '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Teléfono
                </dt>
                <dd class="mt-1 font-medium">
                  {{ order.customer.phone || '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Domicilio
                </dt>
                <dd class="mt-1 font-medium">
                  {{ order.customer.address || '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  {{ isQuote ? 'Fecha de cotización' : 'Fecha del pedido' }}
                </dt>
                <dd class="mt-1 font-medium">
                  {{ formatDate(order.orderDate) }}
                </dd>
              </div>
              <div v-if="!isQuote">
                <dt class="text-sm text-muted">
                  Fecha de entrega
                </dt>
                <dd class="mt-1 font-medium">
                  {{ formatDate(order.promisedDate) }}
                </dd>
              </div>
              <div v-if="!isQuote">
                <dt class="text-sm text-muted">
                  Vendedor
                </dt>
                <dd class="mt-1 font-medium">
                  {{ order.vendedor.name }}
                </dd>
              </div>
              <div v-if="!isQuote">
                <dt class="text-sm text-muted">
                  Repartidor
                </dt>
                <dd class="mt-1">
                  <USelect
                    v-if="mayManageLogistics"
                    v-model="selectedRepartidor"
                    :items="repartidorOptions"
                    value-key="value"
                    :disabled="savingRepartidor"
                    placeholder="Selecciona un repartidor"
                    class="w-full max-w-xs"
                  />
                  <span v-else class="font-medium">
                    {{ order.repartidor?.name || 'Sin asignar' }}
                  </span>
                </dd>
              </div>
              <div v-if="!isQuote">
                <dt class="text-sm text-muted">
                  Estado de pago
                </dt>
                <dd class="mt-1">
                  <USelect
                    v-if="mayManagePayment"
                    v-model="selectedPaymentStatus"
                    :items="paymentStatusOptions"
                    value-key="value"
                    :disabled="savingPayment"
                    placeholder="Estado de pago"
                    class="w-full max-w-xs"
                  />
                  <UBadge
                    v-else
                    :color="paymentStatusColor(order.paymentStatus)"
                    variant="subtle"
                    :label="paymentStatusLabel(order.paymentStatus)"
                  />
                </dd>
              </div>
              <div v-if="!isQuote">
                <dt class="text-sm text-muted">
                  Método de pago
                </dt>
                <dd class="mt-1">
                  <USelect
                    v-if="mayManagePayment"
                    v-model="selectedPaymentMethod"
                    :items="paymentMethodOptions"
                    value-key="value"
                    :disabled="savingPayment"
                    placeholder="Selecciona un método"
                    class="w-full max-w-xs"
                  />
                  <span v-else class="font-medium">
                    {{ paymentMethodLabel(order.paymentMethod) }}
                  </span>
                </dd>
              </div>
              <div v-if="!isQuote">
                <dt class="text-sm text-muted">
                  Requiere factura
                </dt>
                <dd class="mt-1">
                  <UBadge
                    :color="order.requiresInvoice ? 'success' : 'neutral'"
                    variant="subtle"
                    :label="order.requiresInvoice ? 'Sí' : 'No'"
                  />
                </dd>
              </div>
            </dl>
            <div v-if="order.observations" class="mt-4 border-t border-default pt-4">
              <p class="text-sm text-muted">
                Observaciones
              </p>
              <p class="mt-1 whitespace-pre-wrap">
                {{ order.observations }}
              </p>
            </div>
          </UCard>

          <div class="[grid-area:seguimiento] grid gap-4">
            <OrdersOrderStatusPanel
              v-model:status-key="selectedStatus"
              v-model:note="statusNote"
              :order="order"
              :statuses="availableStatuses"
              :saving="savingStatus"
              :entries="order.statusHistory"
              :editable="!isQuote"
            />
          </div>

          <OrdersOrderDetailItems
            class="[grid-area:items]"
            :items="order.items"
            :currency-code="order.currencyCode"
            :order-id="order.id"
            :version="order.version"
            :editable="!isQuote && mayManageLogistics"
            @updated="order = $event"
          />

          <div class="[grid-area:totales] grid gap-4 lg:grid-cols-2">
            <UCard class="lg:col-start-2">
              <template #header>
                <h2 class="font-semibold text-highlighted">
                  Totales
                </h2>
              </template>
              <dl class="space-y-3">
                <div class="flex justify-between gap-4">
                  <dt class="text-muted">
                    Subtotal
                  </dt>
                  <dd class="font-medium">
                    {{ formatCurrency(order.subtotal) }}
                  </dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-muted">
                    Impuestos
                  </dt>
                  <dd class="font-medium">
                    {{ formatCurrency(order.taxTotal) }}
                  </dd>
                </div>
                <div class="flex justify-between gap-4 border-t border-default pt-3">
                  <dt class="font-semibold">
                    Total
                  </dt>
                  <dd class="font-semibold">
                    {{ formatCurrency(order.total) }}
                  </dd>
                </div>
              </dl>
            </UCard>
          </div>
        </div>
      </template>

      <div
        v-else-if="status === 'pending'"
        class="flex flex-col gap-6"
        role="status"
        aria-busy="true"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex flex-col gap-2">
            <USkeleton class="h-4 w-24" />
            <USkeleton class="h-7 w-48" />
            <USkeleton class="h-4 w-32" />
          </div>
          <USkeleton class="h-8 w-28 rounded-full" />
        </div>
        <USkeleton class="h-40 w-full rounded-lg" />
        <AppTableSkeleton :rows="4" :cols="4" />
        <span class="sr-only">Cargando pedido…</span>
      </div>
    </template>
  </UDashboardPanel>
</template>
