<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { tableQueryField, tableQueryText, tableQueryPage } from '~/utils/tableQuery'
import { reportCurrency, reportShortDate } from '~/utils/reportPeriods'
import type { ReportExpenseDetail } from '~/types/reports'
import { dashboardNumber } from '~/utils/dashboardFormatters'

const props = defineProps<{ expenses: ReportExpenseDetail[], periodLabel: string }>()
const search = shallowRef('')
const kind = shallowRef('all')
const page = shallowRef(1)
useTableQuery([
  tableQueryField('expenses_search', search, tableQueryText()),
  tableQueryField('expenses_kind', kind, tableQueryText('all', ['all', 'material', 'operating'])),
  tableQueryField('expenses_page', page, tableQueryPage)
], { page, resetOn: [search, kind] })
const kinds = computed(() => [
  { label: 'Todos', value: 'all', count: props.expenses.length },
  { label: 'Material', value: 'material', count: props.expenses.filter(expense => expense.kind === 'material').length },
  { label: 'Operativos', value: 'operating', count: props.expenses.filter(expense => expense.kind === 'operating').length }
])
const columns: TableColumn<ReportExpenseDetail>[] = [
  { accessorKey: 'date', header: 'Fecha', meta: { class: { td: 'whitespace-nowrap text-muted' } } },
  { accessorKey: 'description', header: 'Concepto / categoría', meta: { class: { td: 'min-w-48' } } },
  { accessorKey: 'provider', header: 'Proveedor', meta: { class: { td: 'min-w-36 text-muted' } } },
  { accessorKey: 'paymentMethod', header: 'Pago', meta: { class: { td: 'text-muted' } } },
  { accessorKey: 'amount', header: 'Importe MXN', meta: { class: { th: 'text-right', td: 'text-right whitespace-nowrap tabular-nums' } } }
]
const pageSize = 10
const filtered = computed(() => {
  const term = search.value.trim().toLocaleLowerCase('es-MX')
  return props.expenses.filter(expense => kind.value === 'all' || expense.kind === kind.value).filter(expense => [expense.description, expense.provider, expense.category, expense.notes].join(' ').toLocaleLowerCase('es-MX').includes(term))
})
const total = computed(() => filtered.value.reduce((sum, expense) => sum + expense.amount, 0))
const visible = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
watch(pages, (total) => {
  if (page.value > total) page.value = total
})
</script>

<template>
  <UModal
    title="Egresos a detalle"
    :description="`${periodLabel} · compras de material y gastos operativos en MXN.`"
    fullscreen
    :ui="{ header: 'shrink-0 pr-16', body: 'min-h-0', footer: 'shrink-0' }"
  >
    <AppButton
      label="Ver egresos a detalle"
      icon="i-lucide-maximize-2"
      color="neutral"
      variant="outline"
    />

    <template #body>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="mt-1 text-sm text-muted tabular-nums">
            {{ filtered.length }} {{ filtered.length === 1 ? 'registro' : 'registros' }} · {{ reportCurrency.format(total) }} MXN{{ search || kind !== 'all' ? ' en resultados' : ' en el periodo' }}
          </p>
        </div>
        <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div class="flex rounded-lg bg-elevated p-0.5" role="group" aria-label="Tipo de egreso">
            <AppButton
              v-for="item in kinds"
              :key="item.value"
              type="button"
              color="neutral"
              :variant="kind === item.value ? 'subtle' : 'ghost'"
              size="xs"
              :aria-pressed="kind === item.value"
              @click="kind = item.value"
            >
              {{ item.label }} <span class="tabular-nums text-dimmed">{{ item.count }}</span>
            </AppButton>
          </div>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Buscar concepto, proveedor…"
            aria-label="Buscar egresos por concepto, proveedor o categoría"
            class="w-full sm:w-64"
          />
        </div>
      </div>
      <DetailTable
        :data="visible"
        :columns="columns"
        :get-row-id="expense => expense.id"
        caption="Gastos del periodo, con importes convertidos a pesos mexicanos"
        :ui="{ caption: 'sr-only' }"
      >
        <template #date-cell="{ row }">
          {{ reportShortDate(row.original.date) }}
        </template>
        <template #description-cell="{ row }">
          <p class="font-medium text-default">
            {{ row.original.description }}
          </p>
          <p class="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <span class="size-1.5 rounded-full" :class="row.original.kind === 'material' ? 'bg-violet-500' : 'bg-warning'" />
            {{ row.original.category }}
          </p>
          <p v-if="row.original.notes" class="mt-1 max-w-sm text-xs text-muted">
            {{ row.original.notes }}
          </p>
        </template>
        <template #amount-cell="{ row }">
          <p class="font-semibold">
            {{ reportCurrency.format(row.original.amount) }}
          </p>
          <p v-if="row.original.currencyCode !== 'MXN'" class="mt-1 text-xs text-muted">
            {{ dashboardNumber.format(row.original.originalAmount) }} {{ row.original.currencyCode }} × {{ row.original.exchangeRate }}
          </p>
        </template>
        <template #empty>
          <UEmpty icon="i-lucide-receipt" :title="search || kind !== 'all' ? 'Sin egresos que coincidan' : 'Sin egresos en este periodo'" />
        </template>
      </DetailTable>
    </template>
    <template v-if="pages > 1" #footer>
      <div class="flex w-full items-center justify-between gap-3">
        <span class="text-xs text-muted">Página {{ page }} de {{ pages }}</span>
        <div class="flex gap-2">
          <AppButton
            label="Anterior"
            color="neutral"
            variant="outline"
            :disabled="page <= 1"
            @click="page--"
          />
          <AppButton
            label="Siguiente"
            color="neutral"
            variant="outline"
            :disabled="page >= pages"
            @click="page++"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
