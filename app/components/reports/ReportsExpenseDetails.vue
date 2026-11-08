<script setup lang="ts">
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
    <UButton
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
            <button
              v-for="item in kinds"
              :key="item.value"
              type="button"
              class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary"
              :class="kind === item.value ? 'bg-default text-highlighted shadow-xs' : 'text-muted hover:text-default'"
              :aria-pressed="kind === item.value"
              @click="kind = item.value"
            >
              {{ item.label }} <span class="tabular-nums text-dimmed">{{ item.count }}</span>
            </button>
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
      <div v-if="visible.length" class="overflow-x-auto">
        <table class="w-full text-sm">
          <caption class="sr-only">
            Gastos del periodo, con importes convertidos a pesos mexicanos
          </caption>
          <thead class="border-b border-default text-xs text-muted">
            <tr>
              <th class="py-3 pr-4 text-left font-medium">
                Fecha
              </th><th class="py-3 pr-4 text-left font-medium">
                Concepto / categoría
              </th><th class="py-3 pr-4 text-left font-medium">
                Proveedor
              </th><th class="py-3 pr-4 text-left font-medium">
                Pago
              </th><th class="py-3 text-right font-medium">
                Importe MXN
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="expense in visible" :key="expense.id" class="align-top">
              <td class="py-4 pr-4 whitespace-nowrap text-muted">
                {{ reportShortDate(expense.date) }}
              </td>
              <td class="min-w-48 py-4 pr-4">
                <p class="font-medium text-default">
                  {{ expense.description }}
                </p>
                <p class="mt-1 flex items-center gap-1.5 text-xs text-muted">
                  <span class="size-1.5 rounded-full" :class="expense.kind === 'material' ? 'bg-violet-500' : 'bg-warning'" />
                  {{ expense.category }}
                </p>
                <p v-if="expense.notes" class="mt-1 max-w-sm text-xs text-muted">
                  {{ expense.notes }}
                </p>
              </td>
              <td class="min-w-36 py-4 pr-4 text-muted">
                {{ expense.provider }}
              </td>
              <td class="py-4 pr-4 text-muted">
                {{ expense.paymentMethod }}
              </td>
              <td class="py-4 text-right whitespace-nowrap tabular-nums">
                <p class="font-semibold">
                  {{ reportCurrency.format(expense.amount) }}
                </p>
                <p v-if="expense.currencyCode !== 'MXN'" class="mt-1 text-xs text-muted">
                  {{ dashboardNumber.format(expense.originalAmount) }} {{ expense.currencyCode }} × {{ expense.exchangeRate }}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <UEmpty v-else icon="i-lucide-receipt" :title="search || kind !== 'all' ? 'Sin egresos que coincidan' : 'Sin egresos en este periodo'" />
    </template>
    <template v-if="pages > 1" #footer>
      <div class="flex w-full items-center justify-between gap-3">
        <span class="text-xs text-muted">Página {{ page }} de {{ pages }}</span>
        <div class="flex gap-2">
          <UButton
            label="Anterior"
            color="neutral"
            variant="outline"
            :disabled="page <= 1"
            @click="page--"
          />
          <UButton
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
