<script setup lang="ts">
import type { ProductActivityPage, ProductActivitySection } from '#shared/types/product-activity'
import type { UserRole } from '~/types/siigo'

const props = defineProps<{ productId: string, role?: UserRole, composite: boolean }>()

const sections = [
  { label: 'Ventas', value: 'sales', icon: 'i-lucide-shopping-cart', description: 'Pedidos y cotizaciones con este producto. El importe corresponde a sus partidas.' },
  { label: 'Compras', value: 'purchases', icon: 'i-lucide-shopping-bag', description: 'Órdenes de compra con este producto. El importe es el subtotal de sus partidas antes de IVA.' },
  { label: 'Recepciones', value: 'receipts', icon: 'i-lucide-package-check', description: 'Cantidades recibidas por orden de compra, incluidas las recepciones anuladas.' },
  { label: 'Kardex', value: 'movements', icon: 'i-lucide-arrow-left-right', description: 'Entradas, salidas, surtidos, devoluciones, traspasos, ajustes y reversiones por almacén.' },
  { label: 'Reservas', value: 'reservations', icon: 'i-lucide-bookmark', description: 'Cantidades apartadas en pedidos activos. La fecha corresponde al pedido.' },
  { label: 'Conteos', value: 'counts', icon: 'i-lucide-clipboard-check', description: 'Conteos físicos y cantidades esperadas por almacén.' },
  { label: 'Gastos', value: 'expenses', icon: 'i-lucide-receipt', description: 'Gastos registrados directamente con este producto.' }
] satisfies Array<{ label: string, value: ProductActivitySection, icon: string, description: string }>

const tabs = computed(() => sections.filter(({ value }) => {
  if (value === 'purchases' || value === 'receipts') return props.role === 'admin'
  if (value === 'counts') return props.role === 'admin' || props.role === 'mostrador'
  return true
}))
const section = shallowRef<ProductActivitySection>('sales')
const page = shallowRef(1)
const recordCount = computed(() => data.value?.pagination.totalResults ?? 0)
const recordLabel = computed(() => section.value === 'movements'
  ? (recordCount.value === 1 ? 'movimiento' : 'movimientos')
  : (recordCount.value === 1 ? 'registro' : 'registros'))
const query = computed(() => ({ section: section.value, page: page.value }))
const { data, status, error, refresh } = useFetch<ProductActivityPage>(
  () => `/api/products/${encodeURIComponent(props.productId)}/activity`,
  { query, key: () => `product-activity-${props.productId}-${section.value}-${page.value}`, lazy: true, server: false }
)

function selectSection(value: string | number) {
  const tab = tabs.value.find(tab => tab.value === value)
  if (!tab) return
  page.value = 1
  section.value = tab.value
}
</script>

<template>
  <section aria-label="Actividad del producto" class="min-w-0 space-y-3">
    <div class="flex items-start justify-between gap-3">
      <UPageCard
        variant="naked"
        description="Historial de operaciones registradas en Carolina Pinturas."
        :ui="{ container: 'gap-1', title: 'text-lg' }"
      >
        <template #title>
          <h2 class="font-semibold">
            Actividad del producto
          </h2>
        </template>
      </UPageCard>
      <UTooltip text="Recargar actividad">
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="ghost"
          aria-label="Recargar actividad"
          :loading="status === 'pending'"
          @click="refresh()"
        />
      </UTooltip>
    </div>
    <UTabs
      :model-value="section"
      :items="tabs"
      variant="link"
      :ui="{ list: 'flex-wrap gap-y-1', trigger: 'flex-1 justify-center', content: 'min-w-0' }"
      @update:model-value="selectSection"
    >
      <template #default="{ item }">
        <UTooltip :text="item.description" :content="{ side: 'top' }">
          <span>{{ item.label }}</span>
        </UTooltip>
      </template>
      <template #content>
        <div class="space-y-4 pt-2">
          <p v-if="composite && ['movements', 'reservations'].includes(section)" class="text-sm text-muted">
            Las reservas y salidas de un producto compuesto se registran en las fichas de sus componentes.
          </p>
          <UAlert
            v-if="error"
            color="error"
            variant="subtle"
            title="No se pudo cargar esta sección."
          />
          <ProductsProductActivityTable
            v-else
            :rows="data?.results ?? []"
            :section="section"
            :loading="['idle', 'pending'].includes(status)"
          />
          <footer v-if="status === 'success' && (data?.pagination.totalResults || page > 1)" class="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
            <span>{{ recordCount }} {{ recordLabel }}</span>
            <UPagination
              v-if="data && (data.pagination.totalPages > 1 || page > 1)"
              v-model:page="page"
              :items-per-page="data.pagination.pageSize"
              :total="data.pagination.totalResults"
              :sibling-count="0"
            />
          </footer>
        </div>
      </template>
    </UTabs>
  </section>
</template>
