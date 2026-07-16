<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { OrderStatus, SalesOrderDetail } from '~/types/orders'
import type { SiigoCustomer, SiigoProduct } from '~/types/siigo'
import { submittedOrderStatusKey, canManageOrderLogistics } from '~/utils/roleAccess'
import { DEFAULT_PAYMENT_STATUS } from '~/utils/orderPayment'
import { discountAmountOf } from '~/utils/orderDiscount'
import { orderListReturnPath } from '~/utils/orderNavigation'
import { resolveCreatedOrderStatusKey } from '~/utils/orderCreation'
import { draftLineTotal } from '~/composables/useOrderDraft'

const props = withDefaults(defineProps<{
  mode?: 'order' | 'quote'
  orderId?: string
}>(), {
  mode: 'order',
  orderId: undefined
})
const route = useRoute()
const router = useRouter()
const isQuoteMode = computed(() => props.mode === 'quote')
const isEditing = computed(() => Boolean(props.orderId))
const returnPath = computed(() => orderListReturnPath(route.query.returnTo))

function orderDetailLocation(orderId: string) {
  return {
    path: `/ventas/${encodeURIComponent(orderId)}`,
    query: { returnTo: returnPath.value }
  }
}

const cancelPath = computed(() => isEditing.value && props.orderId
  ? router.resolve(orderDetailLocation(props.orderId)).fullPath
  : returnPath.value
)
const documentNoun = computed(() => isQuoteMode.value ? 'cotización' : 'pedido')
const documentNounCapitalized = computed(() =>
  documentNoun.value.charAt(0).toUpperCase() + documentNoun.value.slice(1))
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
  paymentStatus: z.string().min(1, 'Selecciona un estado de pago.'),
  paymentMethod: z.string(),
  paymentDate: z.string(),
  requiresInvoice: z.boolean(),
  tags: z.array(z.string()),
  discountType: z.enum(['porcentaje', 'monto']),
  discountValue: z.number().min(0, 'El descuento no puede ser negativo.'),
  observations: z.string().max(5000)
}).superRefine((data, ctx) => {
  if (data.discountType === 'porcentaje' && data.discountValue > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['discountValue'],
      message: 'El descuento porcentual no puede ser mayor a 100%.'
    })
  }
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
  paymentStatus: DEFAULT_PAYMENT_STATUS,
  paymentMethod: 'efectivo',
  paymentDate: isQuoteMode.value ? '' : mexicoToday(),
  requiresInvoice: false,
  tags: [],
  discountType: 'porcentaje',
  discountValue: 0,
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
const modalPhase = shallowRef<'review' | 'sending' | 'done'>('review')
const createdOrder = shallowRef<SalesOrderDetail | null>(null)
const { printTicket, printingTicket } = useTicketPrinter()
const toast = useToast()
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const {
  lines,
  total,
  addProduct,
  removeProduct,
  setObservations,
  setQuantity,
  setPrice,
  setDiscount,
  replaceLines
} = useOrderDraft()
const orderDiscountAmount = computed(() =>
  discountAmountOf(total.value, state.discountType, state.discountValue))
const grandTotal = computed(() => total.value - orderDiscountAmount.value)
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
const { data: tagOptions } = useFetch<string[]>('/api/orders/tags', {
  key: 'order-tags',
  lazy: true,
  default: () => []
})

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
  state.tags = value.tags || []
  state.discountType = value.discountType
  state.discountValue = value.discountValue
  state.observations = value.observations || ''
  replaceLines(value.items.map((item) => {
    // El impuesto se calcula sobre la base ya descontada; el precio con
    // impuesto incluido se detecta comparando contra la base bruta.
    const taxableBase = item.subtotal - item.discountAmount
    const taxPercentage = taxableBase > 0
      ? item.taxAmount / taxableBase * 100
      : 0
    const listedTotal = item.quantity * item.unitPrice
    const taxIncluded = taxPercentage > 0
      && Math.abs(listedTotal - item.subtotal * (1 + taxPercentage / 100)) < 0.01

    // La primera entrada del historial de precio conserva el precio de lista
    // original; sin historial, el precio guardado es el de lista.
    const catalogPrice = item.priceHistory[0]?.previousPrice ?? item.unitPrice
    const lastHistoryNote = item.priceHistory[item.priceHistory.length - 1]?.note

    return {
      productId: item.productId,
      code: item.code,
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      catalogPrice,
      priceNote: item.unitPrice !== catalogPrice ? lastHistoryNote || '' : '',
      taxIncluded,
      taxPercentage,
      discountType: item.discountType,
      discountValue: item.discountValue,
      observations: item.observations || ''
    }
  }))
  initializedOrderId.value = value.id
}, { immediate: true })
const formDisabled = computed(() => saving.value || Boolean(catalogError.value))
const mayChooseInitialStatus = computed(() => user.value?.role === 'admin')
const mayManagePayment = computed(() =>
  Boolean(user.value && canManageOrderLogistics(user.value.role)))
// Mismo permiso que el editor de precio del detalle del pedido.
const mayEditLinePrices = mayManagePayment
const maySaveDraft = computed(() => Boolean(user.value && user.value.role !== 'admin'))
const requestedSendStatusKey = computed(() =>
  user.value
    ? submittedOrderStatusKey(user.value.role, state.statusKey)
    : state.statusKey
)
const selectedRepartidor = computed(() =>
  repartidores.value.find(repartidor => repartidor.id === state.repartidorId)
)
const sendStatusKey = computed(() => resolveCreatedOrderStatusKey(
  requestedSendStatusKey.value,
  selectedRepartidor.value?.esMostrador ?? false
))
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

function onCustomerCreated(customer: SiigoCustomer) {
  customers.value = addCustomerToCatalog(customers.value, customer)
  state.customerId = customer.id
}

async function addSelectedProduct(product: SiigoProduct, quantity: number) {
  let unit = siigoProductUnitParts(product)

  // The bulk product list omits the full unit name; fetch the single-product
  // detail (source of truth, same one used on save) to resolve it.
  if (!unit.name) {
    const detail = await $fetch<SiigoProduct>(`/api/siigo/products/${encodeURIComponent(product.id)}`)
      .catch(() => null)
    unit = detail ? siigoProductUnitParts(detail) : unit
  }

  addProduct({
    id: product.id,
    code: product.code || '—',
    name: product.name,
    unit,
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
  modalPhase.value = 'review'
  createdOrder.value = null
  summaryOpen.value = true
}

function editOrder() {
  modalPhase.value = 'review'
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
  modalPhase.value = 'sending'
  summaryOpen.value = true

  try {
    // El precio sólo viaja cuando el usuario lo editó; si no, el servidor usa
    // el precio de lista vigente en Siigo.
    const requestLines = lines.value.map(line => ({
      productId: line.productId,
      quantity: line.quantity,
      discountType: line.discountType,
      discountValue: line.discountValue,
      ...(line.unitPrice !== line.catalogPrice
        ? { unitPrice: line.unitPrice, priceNote: line.priceNote || null }
        : {}),
      observations: line.observations || null
    }))
    const order = isEditing.value && props.orderId && existingOrder.value
      ? await $fetch<SalesOrderDetail>(`/api/orders/${encodeURIComponent(props.orderId)}`, {
          method: 'PUT',
          body: {
            customerId: data.customerId,
            orderDate: data.orderDate,
            observations: data.observations || null,
            tags: data.tags,
            discountType: data.discountType,
            discountValue: data.discountValue,
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
            paymentMethod: data.paymentMethod || null,
            paymentDate: data.paymentDate || null,
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
    if (isEditing.value) {
      await navigateTo(orderDetailLocation(order.id))
    } else {
      createdOrder.value = order
      modalPhase.value = 'done'
    }
  } catch (error: unknown) {
    modalPhase.value = 'review'
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
            :to="returnPath"
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
        class="shrink-0"
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
            v-model:payment-status="state.paymentStatus"
            v-model:payment-method="state.paymentMethod"
            v-model:payment-date="state.paymentDate"
            v-model:requires-invoice="state.requiresInvoice"
            v-model:tags="state.tags"
            v-model:observations="state.observations"
            :customers="customers?.results || []"
            :statuses="statuses"
            :repartidores="repartidores"
            :tag-options="tagOptions"
            :loading="catalogsLoading"
            :disabled="formDisabled"
            :repartidor-required="repartidorRequired"
            :show-status="mayChooseInitialStatus && !isQuoteMode"
            :show-payment="mayManagePayment"
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
          v-model:discount-type="state.discountType"
          v-model:discount-value="state.discountValue"
          :lines="lines"
          :total="total"
          :discount-amount="orderDiscountAmount"
          :grand-total="grandTotal"
          :quote-mode="isQuoteMode"
          :editable-prices="mayEditLinePrices"
          @remove="removeProduct"
          @observations="setObservations"
          @quantity="setQuantity"
          @price="setPrice"
          @discount="setDiscount"
        />

        <OrdersOrderFormActions
          :saving="saving"
          :saving-draft="savingDraft"
          :disabled="!canSubmit"
          :quote-mode="isQuoteMode"
          :cancel-to="cancelPath"
          @save-draft="saveAsQuote"
        />
      </UForm>

      <UModal
        v-model:open="summaryOpen"
        :title="modalPhase === 'sending'
          ? undefined
          : modalPhase === 'done'
            ? `${documentNounCapitalized} enviado`
            : `Resumen ${documentOf}`"
        :close="false"
        :dismissible="modalPhase !== 'sending'"
      >
        <template #body>
          <div v-if="modalPhase === 'sending'" class="flex flex-col items-center justify-center gap-3 py-10">
            <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
            <p class="text-sm text-muted">
              Enviando {{ documentWithArticle }}…
            </p>
          </div>
          <div v-else-if="modalPhase === 'done'" class="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <UIcon name="i-lucide-circle-check" class="size-10 text-success" />
            <p class="text-lg font-semibold">
              ¡Enviado con éxito!
            </p>
            <p v-if="createdOrder" class="text-sm text-muted">
              {{ documentNounCapitalized }} {{ createdOrder.number }} guardado.
            </p>
          </div>
          <div v-else-if="pendingSubmission" class="space-y-4">
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
                Fecha de entrega
              </p>
              <p class="font-medium">
                {{ formatDate(pendingSubmission.promisedDate) }}
              </p>
            </div>
            <div v-if="pendingSubmission.tags.length">
              <p class="text-sm text-muted">
                Etiquetas
              </p>
              <p class="font-medium">
                {{ pendingSubmission.tags.join(', ') }}
              </p>
            </div>
            <div v-if="pendingSubmission.observations?.trim()">
              <p class="text-sm text-muted">
                Observaciones
              </p>
              <p class="font-medium whitespace-pre-wrap">
                {{ pendingSubmission.observations }}
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
                    <p v-if="line.discountValue > 0" class="text-sm text-error">
                      Descuento: {{ line.discountType === 'porcentaje' ? `${line.discountValue}%` : currency.format(line.discountValue) }}
                    </p>
                  </div>
                  <p class="font-medium">
                    {{ currency.format(draftLineTotal(line)) }}
                  </p>
                </li>
              </ul>
            </div>
            <div
              v-if="orderDiscountAmount > 0"
              class="flex items-center justify-between border-t border-default pt-4"
            >
              <p class="text-sm text-muted">
                {{ isQuoteMode ? 'Descuento a la cotización' : 'Descuento al pedido' }}
              </p>
              <p class="font-medium text-error">
                -{{ currency.format(orderDiscountAmount) }}
              </p>
            </div>
            <div
              class="flex items-center justify-between pt-4"
              :class="orderDiscountAmount > 0 ? '' : 'border-t border-default'"
            >
              <p class="font-semibold text-primary">
                Total
              </p>
              <p class="text-lg font-semibold text-primary">
                {{ currency.format(grandTotal) }}
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

        <template v-if="modalPhase !== 'sending'" #footer>
          <div
            v-if="modalPhase === 'done'"
            class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end"
          >
            <UButton
              label="Ir a pedidos"
              icon="i-lucide-list"
              color="neutral"
              variant="outline"
              class="justify-center"
              @click="navigateTo(returnPath)"
            />
            <UButton
              v-if="createdOrder"
              label="Ver pedido"
              icon="i-lucide-eye"
              color="neutral"
              variant="soft"
              class="justify-center"
              @click="navigateTo(orderDetailLocation(createdOrder.id))"
            />
            <UButton
              v-if="createdOrder"
              label="Imprimir ticket"
              icon="i-lucide-printer"
              class="justify-center"
              :loading="printingTicket"
              @click="printTicket(createdOrder)"
            />
          </div>
          <div v-else class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <UButton
              :label="`Editar ${documentNoun}`"
              icon="i-lucide-pencil"
              color="neutral"
              variant="outline"
              class="justify-center"
              :disabled="saving"
              @click="editOrder"
            />
            <UButton
              v-if="maySaveDraft"
              label="Guardar cotización"
              icon="i-lucide-save"
              color="neutral"
              variant="soft"
              class="justify-center"
              :loading="saving && submittingStatusKey === 'borrador'"
              :disabled="saving"
              @click="confirmSubmit('borrador')"
            />
            <UButton
              :label="sendButtonLabel"
              icon="i-lucide-send"
              class="justify-center"
              :loading="saving && submittingStatusKey === requestedSendStatusKey"
              :disabled="saving || sendBlockedByRepartidor"
              @click="confirmSubmit(requestedSendStatusKey)"
            />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
