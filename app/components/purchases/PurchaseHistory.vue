<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { createNumberFormatter, type CsvColumn } from '@rafamedtech/nuxt-shared/utils'
import type { ListLayoutConfig } from '~/types/list'
import type { OrderDateRange } from '~/types/orders'
import type { PurchaseHistoryPage, PurchaseHistoryRow } from '#shared/types/purchase-history'
import { tableQueryField, tableQueryPage, tableQueryRange } from '~/utils/tableQuery'
import { formatDate } from '~/utils/datetime'

const UBadge = resolveComponent('UBadge')
const NuxtLink = resolveComponent('NuxtLink')

const page = shallowRef(1)
const productId = shallowRef('')
const providerId = shallowRef('')
const dateRange = shallowRef<OrderDateRange | null>(null)
// Un enlace con un identificador inválido no debe dejar la consulta en error 400.
const uuidQuery = {
  parse: (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) ? value : '',
  serialize: (value: string) => value || undefined
}
// USelectMenu con `clear` emite null/undefined; el estado se mantiene como cadena.
const selectedProduct = computed({ get: () => productId.value, set: (value?: string | null) => productId.value = value ?? '' })
const selectedProvider = computed({ get: () => providerId.value, set: (value?: string | null) => providerId.value = value ?? '' })
const { returnTo } = useTableQuery([
  tableQueryField('producto', productId, uuidQuery),
  tableQueryField('proveedor', providerId, uuidQuery),
  tableQueryRange(dateRange, 'date_from', 'date_to'),
  tableQueryField('page', page, tableQueryPage)
], { page, resetOn: [productId, providerId, dateRange] })

const filters = computed(() => ({
  productId: productId.value || undefined,
  providerId: providerId.value || undefined,
  dateFrom: dateRange.value?.start && dateRange.value?.end ? dateRange.value.start.toString() : undefined,
  dateTo: dateRange.value?.start && dateRange.value?.end ? dateRange.value.end.toString() : undefined
}))
const query = computed(() => ({ ...filters.value, page: page.value }))
const { data, error, status, refresh } = useFetch<PurchaseHistoryPage>('/api/purchases/items', { server: false, lazy: true, query })
const loading = computed(() => status.value === 'idle' || status.value === 'pending')
const fetchAllRows = () => fetchAllPages<PurchaseHistoryRow>('/api/purchases/items', { ...filters.value, options: false })
const rows = computed(() => [...(data.value?.results ?? [])])
// Conserva las opciones de la última respuesta para que los selectores no se vacíen al recargar.
const options = shallowRef<PurchaseHistoryPage['options']>({ products: [], providers: [] })
watch(() => data.value?.options, (value) => {
  if (value) options.value = value
})
const productOptions = computed(() => options.value.products.map(option => ({ ...option, description: option.code ? `Código: ${option.code}` : undefined })))

const amount = createNumberFormatter({ minimumFractionDigits: 2, maximumFractionDigits: 6 }, 'en-US')
const quantity = createNumberFormatter({ maximumFractionDigits: 6 }, 'en-US')
const money = (value: string, currencyCode: string) => `$${amount.format(Number(value))} ${currencyCode}`
const units = (value: string, unit: string | null) => unit ? `${quantity.format(Number(value))} ${unit}` : quantity.format(Number(value))
const purchasePath = (orderId: string) => ({ path: `/compras/${orderId}`, query: { returnTo: returnTo.value } })

// `columnLabel` da nombre a la columna en «Personalizar columnas»; sin él se muestra su identificador.
const rightHeader = (label: string) => Object.assign(() => h('div', { class: 'text-right' }, label), { columnLabel: label })
// El servidor pagina y ordena de lo más reciente a lo más antiguo; ordenar en la tabla solo reordenaría la página visible.
const columns: TableColumn<PurchaseHistoryRow>[] = ([{
  accessorKey: 'date', header: 'Fecha', cell: ({ row }) => formatDate(row.original.date)
}, {
  accessorKey: 'folio',
  header: 'Orden',
  cell: ({ row }) => h(NuxtLink, { to: purchasePath(row.original.orderId), class: 'font-semibold text-primary underline' }, () => `OC-${row.original.folio}`)
}, {
  accessorKey: 'providerName',
  header: 'Proveedor',
  // Razones sociales largas empujaban costo e importe fuera de la vista en escritorio.
  cell: ({ row }) => h('p', { class: 'min-w-36 max-w-56 whitespace-normal' }, row.original.providerName)
}, {
  accessorKey: 'name',
  header: 'Producto',
  cell: ({ row }) => h('div', { class: 'min-w-48 max-w-72 whitespace-normal' }, [
    h('p', { class: 'font-medium' }, row.original.name),
    h('p', { class: 'text-xs text-muted' }, row.original.code || 'Sin código')
  ])
}, {
  accessorKey: 'quantity', header: rightHeader('Cantidad'), cell: ({ row }) => h('div', { class: 'text-right' }, units(row.original.quantity, row.original.unit))
}, {
  accessorKey: 'pending',
  header: rightHeader('Pendiente'),
  cell: ({ row }) => h('div', { class: ['text-right', Number(row.original.pending) > 0 ? 'text-warning' : 'text-success'] }, units(row.original.pending, row.original.unit))
}, {
  accessorKey: 'unitCost', header: rightHeader('Costo unitario'), cell: ({ row }) => h('div', { class: 'text-right font-semibold' }, money(row.original.unitCost, row.original.currencyCode))
}, {
  accessorKey: 'total', header: rightHeader('Importe'), cell: ({ row }) => h('div', { class: 'text-right' }, money(row.original.total, row.original.currencyCode))
}, {
  accessorKey: 'isLatest',
  header: 'Última',
  // Solo icono en escritorio para que costo e importe quepan sin desplazar la tabla.
  cell: ({ row }) => row.original.isLatest ? h(UBadge, { 'color': 'primary', 'variant': 'soft', 'icon': 'i-lucide-badge-check', 'aria-label': 'Última compra del producto', 'title': 'Última compra del producto' }) : null
}] satisfies TableColumn<PurchaseHistoryRow>[]).map(column => ({ ...column, enableSorting: false }))

const csvColumns: CsvColumn<PurchaseHistoryRow>[] = [
  { key: 'date', label: 'Fecha', value: row => formatDate(row.date) },
  { key: 'folio', label: 'Orden', value: row => `OC-${row.folio}` },
  { key: 'providerName', label: 'Proveedor' },
  { key: 'code', label: 'Código' },
  { key: 'name', label: 'Producto' },
  { key: 'unit', label: 'Unidad', value: row => row.unit ?? '' },
  { key: 'quantity', label: 'Cantidad' },
  { key: 'received', label: 'Recibido' },
  { key: 'pending', label: 'Pendiente' },
  { key: 'unitCost', label: 'Costo unitario' },
  { key: 'total', label: 'Importe' },
  { key: 'currencyCode', label: 'Moneda' },
  { key: 'isLatest', label: 'Última compra', value: row => row.isLatest ? 'Sí' : '' }
]

const listConfig = computed<ListLayoutConfig>(() => ({
  id: 'purchase-history',
  title: 'Historial de compras',
  empty: 'Sin partidas de compras confirmadas para estos filtros.',
  dateFilter: { subject: 'compras' },
  pagination: { mode: 'server', label: 'partidas', pageSize: data.value?.pagination.pageSize ?? 25 }
}))
const latest = computed(() => loading.value ? null : data.value?.latest)
const optionsLoading = computed(() => loading.value && !options.value.products.length)
</script>

<template>
  <ListLayout
    v-model:date-range="dateRange"
    v-model:page="page"
    :config="listConfig"
    :data="rows"
    :columns="columns"
    :has-extra-filters="Boolean(productId || providerId)"
    :loading="loading"
    :error="Boolean(error)"
    :total-results="data?.pagination.totalResults"
    error-title="No se pudo cargar el historial de compras."
    :error-message="error?.data?.statusMessage"
    @refresh="refresh()"
    @clear="productId = ''; providerId = ''"
  >
    <template #actions>
      <AppCsvExportButton
        filename="historial-compras"
        :columns="csvColumns"
        :rows="rows"
        :fetch-all="fetchAllRows"
        :disabled="loading"
      />
      <UButton
        to="/compras"
        label="Compras"
        icon="i-lucide-shopping-cart"
        aria-label="Compras"
        color="neutral"
        variant="outline"
        :ui="{ label: 'hidden sm:inline' }"
      />
    </template>
    <template #before>
      <!-- shrink-0: el cuerpo del panel es flex en columna con altura fija y comprimía estos bloques en móvil. -->
      <div class="grid shrink-0 gap-3 sm:grid-cols-2">
        <UFormField label="Producto">
          <USelectMenu
            v-model="selectedProduct"
            :items="productOptions"
            :loading="optionsLoading"
            value-key="value"
            :filter-fields="['label', 'code']"
            :search-input="{ placeholder: 'Nombre o código del producto' }"
            icon="i-lucide-package"
            placeholder="Todos los productos"
            clear
            class="w-full min-w-0"
          />
        </UFormField>
        <UFormField label="Proveedor">
          <USelectMenu
            v-model="selectedProvider"
            :items="options.providers"
            :loading="optionsLoading"
            value-key="value"
            :search-input="{ placeholder: 'Nombre del proveedor' }"
            icon="i-lucide-truck"
            placeholder="Todos los proveedores"
            clear
            class="w-full min-w-0"
          />
        </UFormField>
      </div>
      <UAlert
        v-if="latest"
        color="primary"
        variant="subtle"
        icon="i-lucide-badge-check"
        title="Última compra del producto"
        class="shrink-0"
        :description="`OC-${latest.folio} · ${formatDate(latest.date)} · ${latest.providerName} · ${money(latest.unitCost, latest.currencyCode)} por unidad`"
      />
    </template>
    <template #record="{ row }">
      <ListRecordCard
        :title="row.name"
        :eyebrow="`${formatDate(row.date)} · OC-${row.folio} · ${row.code || 'Sin código'}`"
        :to="purchasePath(row.orderId)"
        :fields="[
          { label: 'Proveedor', value: row.providerName, fullWidth: true },
          { label: 'Cantidad', value: units(row.quantity, row.unit) },
          { label: 'Pendiente', value: units(row.pending, row.unit) },
          { label: 'Importe', value: money(row.total, row.currencyCode) }
        ]"
        summary-label="Costo unitario"
        :summary-value="money(row.unitCost, row.currencyCode)"
      >
        <template v-if="row.isLatest" #trailing>
          <UBadge
            color="primary"
            variant="soft"
            icon="i-lucide-badge-check"
            label="Última"
          />
        </template>
      </ListRecordCard>
    </template>
  </ListLayout>
</template>
