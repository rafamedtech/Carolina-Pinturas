<script setup lang="ts">
import type { OrderStatus, SalesOrderDetail } from '~/types/orders'
import {
  canEditOrderRemision,
  canManageOrderLogistics,
  editableOrderStatusKeys
} from '~/utils/roleAccess'

const props = defineProps<{
  orderId: string
}>()

const selectedStatus = shallowRef('')
const statusNote = shallowRef('')
const savingStatus = shallowRef(false)
const remisionDraft = shallowRef('')
const savingRemision = shallowRef(false)
const selectedRepartidor = shallowRef('')
const savingRepartidor = shallowRef(false)
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

watch(() => order.value?.remision, (value) => {
  remisionDraft.value = value || ''
}, { immediate: true })

watch(() => order.value?.repartidor?.id, (value) => {
  selectedRepartidor.value = value || ''
}, { immediate: true })

const remisionUnchanged = computed(() => remisionDraft.value === (order.value?.remision || ''))
const repartidorUnchanged = computed(() => selectedRepartidor.value === (order.value?.repartidor?.id || ''))
const statusUnchanged = computed(() => selectedStatus.value === (order.value?.status.key || ''))

// A borrador order is a quotation document; once it advances to ingresado /
// confirmado (or later) it becomes a regular order with delivery logistics.
const isQuote = computed(() => order.value?.status.key === 'borrador')
const documentLabel = computed(() => isQuote.value ? 'Cotización' : 'Pedido')

const mayEditRemision = computed(() =>
  Boolean(user.value && canEditOrderRemision(user.value.role))
)
const mayManageLogistics = computed(() =>
  Boolean(user.value && canManageOrderLogistics(user.value.role))
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
const savingChanges = computed(() => savingRemision.value || savingRepartidor.value || savingStatus.value)
const hasChanges = computed(() =>
  (mayEditRemision.value && !remisionUnchanged.value)
  || (mayManageLogistics.value && !repartidorUnchanged.value)
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

async function updateRemision() {
  if (!mayEditRemision.value || !order.value || remisionUnchanged.value) return
  savingRemision.value = true

  try {
    order.value = await $fetch<SalesOrderDetail>(
      `/api/orders/${encodeURIComponent(props.orderId)}/remision`,
      {
        method: 'PATCH',
        body: {
          remision: remisionDraft.value || null,
          version: order.value.version
        }
      }
    )
    toast.add({
      title: 'Remisión actualizada',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (fetchError: unknown) {
    const response = fetchError as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'No se pudo actualizar la remisión',
      description: response.data?.statusMessage || response.message || 'Intenta de nuevo.',
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
    await refresh()
  } finally {
    savingRemision.value = false
  }
}

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

  await updateRemision()
  await updateRepartidor()
  await updateStatus()
}
</script>

<template>
  <UDashboardPanel id="order-detail">
    <template #header>
      <UDashboardNavbar :title="order?.number || 'Detalle del pedido'">
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
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="flex items-center gap-1.5 text-sm text-muted">
              <UIcon v-if="isQuote" name="i-lucide-file-text" class="size-4" />
              {{ documentLabel }}
            </p>
            <h1 class="text-xl font-semibold text-highlighted">
              {{ order.number }}
            </h1>
            <p class="mt-1 text-sm text-muted">
              {{ formatDate(order.orderDate) }}
            </p>
          </div>
          <div class="flex items-center gap-4">
            <UButton
              :to="`/ventas/${order.id}/cotizacion`"
              target="_blank"
              :label="isQuote ? 'Ver cotización' : 'Imprimir'"
              icon="i-lucide-printer"
              color="neutral"
              variant="outline"
            />
            <UButton
              label="Guardar cambios"
              icon="i-lucide-save"
              :loading="savingChanges"
              :disabled="savingChanges || !hasChanges"
              @click="saveChanges"
            />
            <div class="text-right">
              <p class="text-sm text-muted">
                Total
              </p>
              <p class="text-xl font-semibold text-highlighted">
                {{ formatCurrency(order.total) }}
              </p>
              <OrdersOrderStatusBadge class="mt-2" :status="order.status" />
            </div>
          </div>
        </div>

        <UAlert
          v-if="isQuote"
          color="info"
          variant="subtle"
          icon="i-lucide-file-text"
          title="Documento de cotización"
          description="Propuesta de precios para el cliente. Los datos de entrega (repartidor, remisión) se asignan al convertirla en pedido."
        />

        <div class="grid gap-4 lg:grid-cols-2">
          <UCard>
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
                  {{ isQuote ? 'Fecha de cotización' : 'Fecha del pedido' }}
                </dt>
                <dd class="mt-1 font-medium">
                  {{ formatDate(order.orderDate) }}
                </dd>
              </div>
              <div v-if="!isQuote">
                <dt class="text-sm text-muted">
                  Fecha prometida
                </dt>
                <dd class="mt-1 font-medium">
                  {{ formatDate(order.promisedDate) }}
                </dd>
              </div>
              <div v-if="!isQuote" class="sm:col-span-2">
                <dt class="text-sm text-muted">
                  Remisión física
                </dt>
                <dd class="mt-1">
                  <UInput
                    v-if="mayEditRemision"
                    v-model="remisionDraft"
                    :disabled="savingRemision"
                    maxlength="100"
                    placeholder="Número de remisión"
                    class="w-full max-w-xs"
                  />
                  <span v-else class="font-medium">
                    {{ order.remision || '—' }}
                  </span>
                </dd>
              </div>
              <div>
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
                  <USelectMenu
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

          <OrdersOrderStatusPanel
            v-model:status-key="selectedStatus"
            v-model:note="statusNote"
            :order="order"
            :statuses="availableStatuses"
            :saving="savingStatus"
          />
        </div>

        <OrdersOrderDetailItems
          :items="order.items"
          :currency-code="order.currencyCode"
        />

        <div class="grid gap-4 lg:grid-cols-2">
          <UCard>
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

          <OrdersOrderHistory :entries="order.statusHistory" />
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
