<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { SiigoCustomer, SiigoListResponse, SiigoProduct } from '~/types/siigo'

const schema = z.object({
  customerId: z.string().min(1, 'Selecciona un cliente.')
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({ customerId: '' })
const selectedProductId = shallowRef('')
const quantity = shallowRef(1)
const toast = useToast()
const { data: customers, status: customerStatus, error: customerError, refresh: refreshCustomers } = useFetch<SiigoListResponse<SiigoCustomer>>('/api/siigo/customers', {
  query: { all: 'true' },
  immediate: false
})
const { data: products, status: productStatus, error: productError, refresh: refreshProducts } = useProductsCatalog()
const { lines, total, addProduct, removeProduct } = useMockOrder()

await Promise.all([
  refreshCustomers(),
  callOnce('products-catalog', refreshProducts)
])

function customerName(name: string[] | undefined) {
  return name?.filter(Boolean).join(' ') || 'Cliente sin nombre'
}

function productPrice(product: SiigoProduct) {
  const priceList = product.prices?.find(price => price.price_list?.some(item => item.position === 1)) ?? product.prices?.[0]
  const value = priceList?.price_list?.find(item => item.position === 1)?.value
    ?? priceList?.price_list?.[0]?.value
    ?? product.price
  const amount = typeof value === 'string' ? Number(value) : value

  return Number.isFinite(amount) ? Number(amount) : 0
}

const customerOptions = computed(() => (customers.value?.results || []).map(customer => ({
  label: customerName(customer.name),
  value: customer.id
})))
const productOptions = computed(() => (products.value?.results || []).map(product => ({
  label: product.name,
  description: product.code,
  value: product.id
})))
const catalogError = computed(() => customerError.value?.data?.statusMessage || productError.value?.data?.statusMessage || '')
const catalogsLoading = computed(() => customerStatus.value === 'pending' || productStatus.value === 'pending')
const canAddProduct = computed(() => Boolean(selectedProductId.value) && quantity.value > 0)

function addSelectedProduct() {
  const product = products.value?.results.find(item => item.id === selectedProductId.value)
  if (!product) return

  addProduct({
    id: product.id,
    code: product.code || '—',
    name: product.name,
    quantity: quantity.value,
    unitPrice: productPrice(product)
  })
  selectedProductId.value = ''
  quantity.value = 1
}

function submitMockOrder(event: FormSubmitEvent<Schema>) {
  if (!lines.value.length) return

  const customer = customerOptions.value.find(item => item.value === event.data.customerId)
  toast.add({
    title: 'Pedido simulado',
    description: `Se preparó un pedido para ${customer?.label || 'el cliente seleccionado'} sin guardarlo en Siigo.`,
    color: 'success',
    icon: 'i-lucide-circle-check'
  })
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
            aria-label="Volver a ventas"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        color="info"
        variant="subtle"
        title="Pedido de prueba"
        description="Este formulario no guarda ni envía información a Siigo. La persistencia se agregará en una siguiente etapa."
        icon="i-lucide-flask-conical"
      />

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
        @submit="submitMockOrder"
      >
        <div class="grid gap-4 lg:grid-cols-2">
          <UCard>
            <template #header>
              <h2 class="font-semibold text-highlighted">
                Cliente
              </h2>
            </template>
            <UFormField name="customerId" label="Cliente" required>
              <USelectMenu
                v-model="state.customerId"
                :items="customerOptions"
                value-key="value"
                :loading="customerStatus === 'pending'"
                :disabled="Boolean(customerError)"
                placeholder="Buscar cliente"
                class="w-full"
              />
            </UFormField>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="font-semibold text-highlighted">
                Agregar producto
              </h2>
            </template>
            <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
              <UFormField name="product" label="Producto">
                <USelectMenu
                  v-model="selectedProductId"
                  :items="productOptions"
                  value-key="value"
                  :loading="productStatus === 'pending'"
                  :disabled="Boolean(productError)"
                  placeholder="Buscar producto"
                  class="w-full"
                />
              </UFormField>
              <UFormField name="quantity" label="Cantidad">
                <UInputNumber
                  v-model="quantity"
                  :min="1"
                  :step="1"
                  class="w-full"
                />
              </UFormField>
              <UButton
                label="Agregar"
                icon="i-lucide-plus"
                :disabled="!canAddProduct || catalogsLoading"
                @click="addSelectedProduct"
              />
            </div>
          </UCard>
        </div>

        <OrdersOrderLinesTable :lines="lines" :total="total" @remove="removeProduct" />

        <div class="mt-auto flex flex-col-reverse gap-3 border-t border-default pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-sm text-muted">
            El pedido se mantiene sólo en esta pantalla hasta que agreguemos persistencia.
          </p>
          <div class="flex gap-2">
            <UButton
              to="/ventas"
              label="Cancelar"
              color="neutral"
              variant="outline"
            />
            <UButton
              type="submit"
              label="Generar pedido simulado"
              icon="i-lucide-check"
              :disabled="!lines.length || catalogsLoading"
            />
          </div>
        </div>
      </UForm>
    </template>
  </UDashboardPanel>
</template>
