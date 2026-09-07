<script setup lang="ts">
import { reportCurrency, reportShortDate } from '~/utils/reportPeriods'
import type { ReportExpenseDetail } from '~/types/reports'
import { dashboardNumber } from '~/utils/dashboardFormatters'

const props = defineProps<{ expenses: ReportExpenseDetail[] }>()
const search = shallowRef('')
const page = shallowRef(1)
const pageSize = 10
const filtered = computed(() => {
  const term = search.value.trim().toLocaleLowerCase('es-MX')
  return props.expenses.filter(expense => [expense.description, expense.provider, expense.category, expense.notes].join(' ').toLocaleLowerCase('es-MX').includes(term))
})
const total = computed(() => filtered.value.reduce((sum, expense) => sum + expense.amount, 0))
const visible = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
watch([search, () => props.expenses], () => {
  page.value = 1
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-base font-semibold text-highlighted">
            Gastos a detalle
          </h2>
          <p class="mt-1 text-sm text-muted">
            {{ filtered.length }} {{ filtered.length === 1 ? 'gasto' : 'gastos' }} · {{ reportCurrency.format(total) }} MXN{{ search ? ' en resultados' : ' en el mes' }}
          </p>
        </div>
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Buscar concepto, proveedor…"
          aria-label="Buscar gastos por concepto, proveedor o categoría"
          class="w-full sm:w-72"
        />
      </div>
    </template>
    <div v-if="visible.length" class="overflow-x-auto">
      <table class="w-full text-sm">
        <caption class="sr-only">
          Gastos del mes, con importes convertidos a pesos mexicanos
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
              <p class="mt-1 text-xs text-muted">
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
    <UEmpty v-else icon="i-lucide-receipt" :title="search ? 'Sin gastos que coincidan' : 'Sin gastos en este mes'" />
    <template v-if="pages > 1" #footer>
      <div class="flex items-center justify-between gap-3">
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
  </UCard>
</template>
