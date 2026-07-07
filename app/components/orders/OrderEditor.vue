<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { OrderStatus, SalesOrderDetail } from '~/types/orders'
import type { SiigoCustomer, SiigoProduct } from '~/types/siigo'
import { submittedOrderStatusKey } from '~/utils/roleAccess'

const props = withDefaults(defineProps<{
  mode?: 'order' | 'quote'
  orderId?: string
}>(), {
  mode: 'order',
  orderId: undefined
})
const isQuoteMode = computed(() => props.mode === 'quote')
const isEditing = computed(() => Boolean(props.orderId))
const documentNoun = computed(() => isQuoteMode.value ? 'cotización' : 'pedido')
const documentWithArticle = computed(() => isQuoteMode.value ? 'la cotización' : 'el pedido')
const documentOf = computed(() => isQuoteMode.value ? 'de la cotización' : 'del pedido')
const pageTitle = computed(() => isEditing.value
  ? 'Editar cotización'
  : isQuoteMode.value ? 'Nueva cotización' : 'Nuevo pedido')

// Repartidor is optional while the order is borrador/ingresado; required to confirm.
const STATUS_KEYS_REQUIRING_REPARTIDOR = ['confirmado', 'surtido', 'en_espera']

const schema = z.object({
  customerId: z.string().uuid('Selecciona un cliente.'),
  statusKey: z.string().min(1, 'Selecciona un estado.'),
  repartidorId: z.string(),
  orderDate: z.string().min(1, `Selecciona la fecha ${documentOf.value}.`),
  promisedDate: z.string(),
  observations: z.string().max(5000)
}).superRefine((data, ctx) => {
  if (STATUS_KEYS_REQUIRING_REPARTIDOR.includes(data.statusKey) && !data.repartidorId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['repartidorId'],
      message: `Selecciona un repartidor para confirmar ${documentWithArticle.value}.`
    })
  }
})

type Schema = z.output<typeof schema>

function productPrice(product: SiigoProduct) {
  const price = product.prices?.find(item =>
    item.currency_code === 'MXN' && item.price_list?.some(entry => entry.position === 1)
  ) ?? product.prices?.find(item => item.price_list?.some(entry => entry.position === 1))
  ?? product.prices?.[0]
  const value = price?.price_list?.find(item => item.position === 1)?.value
    ?? price?.price_list?.[0]?.value
    ?? product.price
  const amount = Number(value)

  return Number.isFinite(amount) ? amount : 0
}

const { user } = useAuth()
const state = reactive<Schema>({
  customerId: '',
  statusKey: isQuoteMode.value
    ? 'borrador'
    : user.value?.role === 'admin' ? 'ingresado' : 'borrador',
  repartidorId: '',
  orderDate: mexicoToday(),
  promisedDate: isQuoteMode.value ? '' : mexicoToday(),
  observations: ''
})
const saving = shallowRef(false)
const submittingStatusKey = shallowRef<string | null>(null)
// Los catálogos de clientes/productos se cargan con `server: false` (evita
// un hydration mismatch cuando el SSR no alcanza a paginar todo el catálogo
// de Siigo). Eso hace que `status` pase a 'pending' apenas se monta en el
// cliente, mientras el server nunca lo vio así: sin esta guarda, el spinner
// de carga del selector aparecería solo en el cliente y produciría el mismo
// tipo de mismatch un nivel más arriba.
const isHydrated = shallowRef(false)
onMounted(() => {
  isHydrated.value = true
})
const summaryOpen = shallowRef(false)
const pendingSubmission = shallowRef<Schema | null>(null)
const toast = useToast()
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const {
  lines,
  total,
  addProduct,
  removeProduct,
  setObservations,
  setQuantity,
  replaceLines
} = useOrderDraft()
const {
  data: existingOrder,
  status: existingOrderStatus,
  error: existingOrderError
} = useFetch<SalesOrderDetail>(
  () => `/api/orders/${encodeURIComponent(props.orderId || '')}`,
  {
    key: `edit-quote-${props.orderId || 'new'}`,
    lazy: true,
    immediate: isEditing.value
  }
)
const {
  data: customers,
  status: customerStatus,
  error: customerError
} = useCustomersCatalog()
const {
  data: products,
  status: productStatus,
  error: productError
} = useProductsCatalog()
const {
  data: statuses,
  status: statusStatus,
  error: statusError
} = useFetch<OrderStatus[]>('/api/orders/statuses', {
  key: 'order-statuses',
  lazy: true,
  default: () => []
})
const {
  data: repartidores,
  status: repartidorStatus,
  error: repartidorError
} = useRepartidoresCatalog()

// Mostrador attends walk-in customers, so the order defaults to the in-store
// "Mostrador" repartidor; they can still pick a real one for home delivery.
const defaultRepartidorId = computed(() => {
  if (user.value?.role === 'mostrador') {
    return repartidores.value.find(repartidor => repartidor.esMostrador)?.id || ''
  }
  return user.value?.repartidorId || ''
})

watch(
  [defaultRepartidorId, repartidores],
  ([desiredId, availableRepartidores]) => {
    if (
      !state.repartidorId
      && desiredId
      && availableRepartidores.some(repartidor => repartidor.id === desiredId)
    ) {
      state.repartidorId = desiredId
    }
  },
  { immediate: true }
)

const existingOrderStatusError = computed(() =>
  existingOrder.value && existingOrder.value.status.key !== 'borrador'
    ? 'Este documento ya no es una cotización y no puede editarse.'
    : ''
)
const catalogError = computed(() =>
  existingOrderStatusError.value
  || existingOrderError.value?.data?.statusMessage
  || customerError.value?.data?.statusMessage
  || productError.value?.data?.statusMessage
  || statusError.value?.data?.statusMessage
  || repartidorError.value?.data?.statusMessage
  || ''
)
const catalogsLoading = computed(() =>
  isHydrated.value
  && (
    (isEditing.value && existingOrderStatus.value !== 'success')
    || customerStatus.value === 'pending'
    || productStatus.value === 'pending'
    || statusStatus.value === 'pending'
    || repartidorStatus.value === 'pending'
  )
)

const initializedOrderId = shallowRef<string | null>(null)
watch(existingOrder, (value) => {
  if (!value || initializedOrderId.value === value.id) return

  state.customerId = value.customer.id
  state.statusKey = value.status.key
  state.orderDate = value.orderDate
  state.observations = value.observations || ''
  replaceLines(value.items.map((item) => {
    const listedTotal = item.quantity * item.unitPrice
    const taxIncluded = Math.abs(listedTotal - item.total) < 0.01
    const taxPercentage = item.subtotal > 0
      ? item.taxAmount / item.subtotal * 100
      : 0

    return {
      productId: item.productId,
      code: item.code,
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxIncluded,
      taxPercentage,
      observations: item.observations || ''
    }
  }))
  initializedOrderId.value = value.id
}, { immediate: true })
const formDisabled = computed(() => saving.value || Boolean(catalogError.value))
const mayChooseInitialStatus = computed(() => user.value?.role === 'admin')
const maySaveDraft = computed(() => Boolean(user.value && user.value.role !== 'admin'))
const sendStatusKey = computed(() =>
  user.value
    ? submittedOrderStatusKey(user.value.role, state.statusKey)
    : state.statusKey
)
const sendStatusLabel = computed(() =>
  statuses.value.find(status => status.key === sendStatusKey.value)?.label
  || sendStatusKey.value
)
const sendButtonLabel = computed(() =>
  mayChooseInitialStatus.value
    ? `Guardar como ${sendStatusLabel.value.toLowerCase()}`
    : 'Enviar'
)
const repartidorRequired = computed(() =>
  STATUS_KEYS_REQUIRING_REPARTIDOR.includes(state.statusKey)
)
const sendRequiresRepartidor = computed(() =>
  STATUS_KEYS_REQUIRING_REPARTIDOR.includes(sendStatusKey.value)
)
const sendBlockedByRepartidor = computed(() =>
  Boolean(
    pendingSubmission.value
    && sendRequiresRepartidor.value
    && !pendingSubmission.value.repartidorId
  )
)
const canSubmit = computed(() =>
  Boolean(state.customerId)
  && Boolean(state.statusKey)
  && (!repartidorRequired.value || Boolean(state.repartidorId))
  && Boolean(state.orderDate)
  && lines.value.length > 0
  && !catalogsLoading.value
  && !formDisabled.value
)

const selectedCustomer = computed(() =>
  customers.value?.results.find(customer => customer.id === state.customerId)
)
const selectedCustomerName = computed(() =>
  selectedCustomer.value?.name?.filter(Boolean).join(' ') || selectedCustomer.value?.rfc_id || '—'
)

function formatDate(value: string) {
  if (!value) return '—'
  return value.split('-').reverse().join('/')
}

function documentMessage(message: string) {
  if (!isQuoteMode.value) return message

  return message
    .replace(/\bPedidos\b/g, 'Cotizaciones')
    .replace(/\bpedidos\b/g, 'cotizaciones')
    .replace(/\bPedido\b/g, 'Cotización')
    .replace(/\bpedido\b/g, 'cotización')
}

function lineTotal(line: { quantity: number, unitPrice: number, taxIncluded: boolean, taxPercentage: number }) {
  const listedTotal = line.quantity * line.unitPrice
  return line.taxIncluded ? listedTotal : listedTotal * (1 + line.taxPercentage / 100)
}

function onCustomerCreated(customer: SiigoCustomer) {
  customers.value = addCustomerToCatalog(customers.value, customer)
  state.customerId = customer.id
}

async function addSelectedProduct(product: SiigoProduct, quantity: number) {
  let unit = product.unit

  // The bulk product list omits the full unit name; fetch the single-product
  // detail (source of truth, same one used on save) to resolve it.
  if (!unit?.name) {
    const detail = await $fetch<SiigoProduct>(`/api/siigo/products/${encodeURIComponent(product.id)}`)
      .catch(() => null)
    unit = detail?.unit ?? unit
  }

  addProduct({
    id: product.id,
    code: product.code || '—',
    name: product.name,
    unit: {
      code: unit?.code || null,
      name: unit?.name || null
    },
    quantity,
    unitPrice: productPrice(product),
    taxIncluded: product.tax_included ?? false,
    taxPercentage: (product.taxes || []).reduce((sum, tax) =>
      sum + (Number(tax.percentage) || 0), 0)
  })
}

function reviewOrder(event: FormSubmitEvent<Schema>) {
  if (!canSubmit.value) return
  pendingSubmission.value = event.data
  summaryOpen.value = true
}

function editOrder() {
  summaryOpen.value = false
}

const savingDraft = computed(() => saving.value && submittingStatusKey.value === 'borrador')

// Save straight as a quote (borrador) without opening the review summary.
function saveAsQuote() {
  if (!canSubmit.value || saving.value) return
  pendingSubmission.value = { ...state }
  confirmSubmit('borrador')
}

async function confirmSubmit(statusKey: string) {
  if (!pendingSubmission.value || !canSubmit.value) return

  if (STATUS_KEYS_REQUIRING_REPARTIDOR.includes(statusKey) && !pendingSubmission.value.repartidorId) {
    toast.add({
      title: 'Selecciona un repartidor',
      description: `${isQuoteMode.value ? 'La cotización' : 'El pedido'} necesita un repartidor antes de guardarse como ${isQuoteMode.value ? 'confirmada' : 'confirmado'}.`,
      color: 'warning',
      icon: 'i-lucide-truck'
    })
    return
  }

  const data = { ...pendingSubmission.value, statusKey }
  saving.value = true
  submittingStatusKey.value = statusKey

  try {
    const requestLines = lines.value.map(line => ({
      productId: line.productId,
      quantity: line.quantity,
      observations: line.observations || null
    }))
    const order = isEditing.value && props.orderId && existingOrder.value
      ? await $fetch<SalesOrderDetail>(`/api/orders/${encodeURIComponent(props.orderId)}`, {
          method: 'PUT',
          body: {
            customerId: data.customerId,
            orderDate: data.orderDate,
            observations: data.observations || null,
            lines: requestLines,
            version: existingOrder.value.version
          }
        })
      : await $fetch<SalesOrderDetail>('/api/orders', {
          method: 'POST',
          body: {
            ...data,
            repartidorId: data.repartidorId || null,
            promisedDate: data.promisedDate || null,
            observations: data.observations || null,
            lines: requestLines
          }
        })

    toast.add({
      title: isEditing.value
        ? `Cotización ${order.number} actualizada`
        : statusKey === 'borrador'
          ? `Cotización ${order.number} guardada`
          : `Pedido ${order.number} guardado`,
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
    await navigateTo(isEditing.value ? `/ventas/${order.id}` : '/ventas')
  } catch (error: unknown) {
    const fetchError = error as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: `No se pudo guardar ${documentWithArticle.value}`,
      description: documentMessage(
        fetchError.data?.statusMessage || fetchError.message || 'Intenta de nuevo.'
      ),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    saving.value = false
    submittingStatusKey.value = null
  }
}
</script>

<template>
  <UDashboardPanel id="new-order">
    <template #header>
      <UDashboardNavbar :title="pageTitle">
        <template #leading>
          <UButton
            to="/ventas"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            aria-label="Volver a ventas"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="catalogError"
        color="warning"
        variant="subtle"
        title="No se pudieron cargar los catálogos"
        :description="catalogError"
        icon="i-lucide-plug-zap"
      />

      <UForm
        :schema="schema"
        :state="state"
        class="contents"
        @submit="reviewOrder"
      >
        <div class="grid gap-4 lg:grid-cols-2">
          <OrdersOrderCustomerFields
            v-model:customer-id="state.customerId"
            v-model:status-key="state.statusKey"
            v-model:repartidor-id="state.repartidorId"
            v-model:order-date="state.orderDate"
            v-model:promised-date="state.promisedDate"
            v-model:observations="state.observations"
            :customers="customers?.results || []"
            :statuses="statuses"
            :repartidores="repartidores"
            :loading="catalogsLoading"
            :disabled="formDisabled"
            :repartidor-required="repartidorRequired"
            :show-status="mayChooseInitialStatus && !isQuoteMode"
            :quote-mode="isQuoteMode"
            @customer-created="onCustomerCreated"
          />

          <OrdersOrderProductPicker
            :products="products?.results || []"
            :loading="isHydrated && productStatus === 'pending'"
            :disabled="formDisabled"
            @add="addSelectedProduct"
          />
        </div>

        <OrdersOrderLinesTable
          :lines="lines"
          :total="total"
          :quote-mode="isQuoteMode"
          :cancel-to="isEditing && orderId ? `/ventas/${orderId}` : '/ventas'"
          @remove="removeProduct"
          @observations="setObservations"
          @quantity="setQuantity"
        />

        <OrdersOrderFormActions
          :saving="saving"
          :saving-draft="savingDraft"
          :disabled="!canSubmit"
          :quote-mode="isQuoteMode"
          @save-draft="saveAsQuote"
        />
      </UForm>

      <UModal v-model:open="summaryOpen" :title="`Resumen ${documentOf}`">
        <template #body>
          <div v-if="pendingSubmission" class="space-y-4">
            <div>
              <p class="text-sm text-muted">
                Cliente
              </p>
              <p class="font-medium">
                {{ selectedCustomerName }}
              </p>
            </div>
            <div>
              <p class="text-sm text-muted">
                Fecha prometida
              </p>
              <p class="font-medium">
                {{ formatDate(pendingSubmission.promisedDate) }}
              </p>
            </div>
            <div>
              <p class="text-sm text-muted">
                Observaciones
              </p>
              <p class="font-medium whitespace-pre-wrap">
                {{ pendingSubmission.observations || '—' }}
              </p>
            </div>
            <div>
              <p class="mb-2 text-sm text-muted">
                Partidas
              </p>
              <ul class="divide-y divide-default rounded-lg border border-default">
                <li
                  v-for="line in lines"
                  :key="line.productId"
                  class="flex items-center justify-between gap-4 px-3 py-2"
                >
                  <div>
                    <p class="font-medium">
                      {{ line.name }}
                    </p>
                    <p class="text-sm text-muted">
                      {{ line.quantity }} {{ line.unit.name || line.unit.code || '' }} × {{ currency.format(line.unitPrice) }}
                    </p>
                  </div>
                  <p class="font-medium">
                    {{ currency.format(lineTotal(line)) }}
                  </p>
                </li>
              </ul>
            </div>
            <div class="flex items-center justify-between border-t border-default pt-4">
              <p class="font-semibold">
                Total
              </p>
              <p class="text-lg font-semibold">
                {{ currency.format(total) }}
              </p>
            </div>
            <UAlert
              v-if="sendBlockedByRepartidor"
              color="warning"
              variant="subtle"
              title="Falta seleccionar un repartidor"
              :description="`Es necesario para enviar ${documentWithArticle} como ${sendStatusLabel.toLowerCase()}.`"
              icon="i-lucide-truck"
            />
          </div>
        </template>

        <template #footer>
          <div class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <UButton
              :label="`Editar ${documentNoun}`"
              icon="i-lucide-pencil"
              color="neutral"
              variant="outline"
              :disabled="saving"
              @click="editOrder"
            />
            <UButton
              v-if="maySaveDraft"
              label="Guardar cotización"
              icon="i-lucide-save"
              color="neutral"
              variant="soft"
              :loading="saving && submittingStatusKey === 'borrador'"
              :disabled="saving"
              @click="confirmSubmit('borrador')"
            />
            <UButton
              :label="sendButtonLabel"
              icon="i-lucide-send"
              :loading="saving && submittingStatusKey === sendStatusKey"
              :disabled="saving || sendBlockedByRepartidor"
              @click="confirmSubmit(sendStatusKey)"
            />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
