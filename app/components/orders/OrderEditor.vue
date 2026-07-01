<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { OrderStatus, SalesOrderDetail } from '~/types/orders'
import type { SiigoProduct } from '~/types/siigo'

const schema = z.object({
  customerId: z.string().uuid('Selecciona un cliente.'),
  statusKey: z.string().min(1, 'Selecciona un estado.'),
  orderDate: z.string().min(1, 'Selecciona la fecha del pedido.'),
  promisedDate: z.string(),
  remision: z.string().max(100),
  observations: z.string().max(5000)
})

type Schema = z.output<typeof schema>

function localDate() {
  const today = new Date()
  const offset = today.getTimezoneOffset() * 60_000
  return new Date(today.getTime() - offset).toISOString().slice(0, 10)
}

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

const state = reactive<Schema>({
  customerId: '',
  statusKey: 'ingresado',
  orderDate: localDate(),
  promisedDate: '',
  remision: '',
  observations: ''
})
const saving = shallowRef(false)
const toast = useToast()
const { lines, total, addProduct, removeProduct } = useOrderDraft()
const {
  data: customers,
  status: customerStatus,
  error: customerError,
  refresh: refreshCustomers
} = useCustomersCatalog()
const {
  data: products,
  status: productStatus,
  error: productError,
  refresh: refreshProducts
} = useProductsCatalog()
const {
  data: statuses,
  status: statusStatus,
  error: statusError,
  refresh: refreshStatuses
} = useFetch<OrderStatus[]>('/api/orders/statuses', {
  key: 'order-statuses',
  immediate: false,
  default: () => []
})

await Promise.all([
  callOnce('customers-catalog', refreshCustomers),
  callOnce('products-catalog', refreshProducts),
  callOnce('order-statuses', refreshStatuses)
])

const catalogError = computed(() =>
  customerError.value?.data?.statusMessage
  || productError.value?.data?.statusMessage
  || statusError.value?.data?.statusMessage
  || ''
)
const catalogsLoading = computed(() =>
  customerStatus.value === 'pending'
  || productStatus.value === 'pending'
  || statusStatus.value === 'pending'
)
const formDisabled = computed(() => saving.value || Boolean(catalogError.value))
const canSubmit = computed(() =>
  Boolean(state.customerId)
  && Boolean(state.statusKey)
  && Boolean(state.orderDate)
  && lines.value.length > 0
  && !catalogsLoading.value
  && !formDisabled.value
)

function addSelectedProduct(product: SiigoProduct, quantity: number) {
  addProduct({
    id: product.id,
    code: product.code || '—',
    name: product.name,
    quantity,
    unitPrice: productPrice(product),
    taxIncluded: product.tax_included ?? false,
    taxPercentage: (product.taxes || []).reduce((sum, tax) =>
      sum + (Number(tax.percentage) || 0), 0)
  })
}

async function submitOrder(event: FormSubmitEvent<Schema>) {
  if (!canSubmit.value) return
  saving.value = true

  try {
    const order = await $fetch<SalesOrderDetail>('/api/orders', {
      method: 'POST',
      body: {
        ...event.data,
        promisedDate: event.data.promisedDate || null,
        remision: event.data.remision || null,
        observations: event.data.observations || null,
        lines: lines.value.map(line => ({
          productId: line.productId,
          quantity: line.quantity
        }))
      }
    })

    toast.add({
      title: `Pedido ${order.number} guardado`,
      description: 'Las partidas y los datos de Siigo quedaron almacenados en PostgreSQL.',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
    await navigateTo(`/ventas/${encodeURIComponent(order.id)}`)
  } catch (error: unknown) {
    const fetchError = error as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'No se pudo guardar el pedido',
      description: fetchError.data?.statusMessage || fetchError.message || 'Intenta de nuevo.',
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="new-order">
    <template #header>
      <UDashboardNavbar title="Nuevo pedido">
        <template #leading>
          <UButton
            to="/ventas"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            aria-label="Volver a pedidos"
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
        @submit="submitOrder"
      >
        <div class="grid gap-4 lg:grid-cols-2">
          <OrdersOrderCustomerFields
            v-model:customer-id="state.customerId"
            v-model:status-key="state.statusKey"
            v-model:order-date="state.orderDate"
            v-model:promised-date="state.promisedDate"
            v-model:remision="state.remision"
            v-model:observations="state.observations"
            :customers="customers?.results || []"
            :statuses="statuses"
            :loading="catalogsLoading"
            :disabled="formDisabled"
          />

          <OrdersOrderProductPicker
            :products="products?.results || []"
            :loading="productStatus === 'pending'"
            :disabled="formDisabled"
            @add="addSelectedProduct"
          />
        </div>

        <OrdersOrderLinesTable
          :lines="lines"
          :total="total"
          @remove="removeProduct"
        />

        <OrdersOrderFormActions
          :saving="saving"
          :disabled="!canSubmit"
        />
      </UForm>
    </template>
  </UDashboardPanel>
</template>
