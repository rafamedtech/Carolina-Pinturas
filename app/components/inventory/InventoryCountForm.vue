<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { createReusableTemplate, useMediaQuery } from '@vueuse/core'
import type { InventoryCount } from '#shared/types/inventory'
import type { InventoryCommand } from '#shared/schemas/inventory'
import { formatDate } from '~/utils/datetime'

const { canWrite } = useAuth()
const props = defineProps<{ count: InventoryCount, admin: boolean, busy: boolean, activated?: boolean }>()
const emit = defineEmits<{ submit: [command: InventoryCommand['command']] }>()
const desktop = useMediaQuery('(min-width: 48rem)', { ssrWidth: 768 })
type CountLine = InventoryCount['lines'][number]
const [DefineAmount, AmountInput] = createReusableTemplate<{ line: CountLine }>()
const [DefineCost, CostInputs] = createReusableTemplate<{ line: CountLine }>()
const [DefineRemove, RemoveButton] = createReusableTemplate<{ line: CountLine }>()
const costs = reactive<Record<string, number | undefined>>({})
const currencies = reactive<Record<string, 'MXN' | 'USD'>>({})
const amounts = reactive<Record<string, string>>({})
watch(() => props.count, (c, previous) => {
  const oldLines = new Map(previous?.id === c.id ? previous.lines.map(l => [l.productId, l]) : [])
  for (const key of Object.keys(amounts)) if (!c.lines.some(l => l.productId === key)) Reflect.deleteProperty(amounts, key)
  for (const l of c.lines) {
    const old = oldLines.get(l.productId)
    if (!old || old.baseVersion !== l.baseVersion || old.counted !== l.counted) amounts[l.productId] = l.counted ?? ''
    if (!old || old.unitCost !== l.unitCost) costs[l.productId] = l.unitCost ? Number(l.unitCost) : undefined
    if (!old || old.costCurrency !== l.costCurrency) currencies[l.productId] = l.costCurrency === 'USD' ? 'USD' : 'MXN'
  }
}, { immediate: true })
const columns = computed<TableColumn<CountLine>[]>(() => {
  const columns: TableColumn<CountLine>[] = [
    { id: 'product', accessorFn: line => `${line.product.code} · ${line.product.name}`, header: 'Producto' },
    {
      id: 'expected',
      accessorFn: line => Number(line.expected),
      header: 'Esperado',
      cell: ({ row }) => row.original.expected,
      meta: { class: { th: 'text-right', td: 'text-right font-mono' } }
    },
    { id: 'counted', header: 'Conteo físico' }
  ]
  if (!props.activated) columns.push({ id: 'cost', header: 'Costo unitario (con impuestos)' })
  if (canWrite.value && props.count.status === 'borrador') columns.push({ id: 'actions', header: 'Acciones', meta: { class: { th: 'sr-only' } } })
  return columns
})
const closed = computed(() => !canWrite.value || ['aplicado', 'cancelado'].includes(props.count.status))
const productIds = computed(() => props.count.lines.map(l => l.productId))
const unsaved = computed(() => props.count.lines.some(l => (amounts[l.productId] ?? '') !== (l.counted ?? '') || (!props.activated && ((costs[l.productId] === undefined ? null : String(costs[l.productId])) !== (l.unitCost ?? null) || (l.unitCost && currencies[l.productId] !== l.costCurrency)))))
const canSubmit = computed(() => props.count.lines.length > 0 && !unsaved.value && props.count.lines.every(l => l.counted !== null && (props.activated || Number(l.counted) === 0 || Number(l.unitCost) > 0)))
function changeProduct(action: 'countAdd' | 'countRemove', productId: string) {
  emit('submit', { action, id: props.count.id, version: props.count.version, productId })
}
function save() {
  emit('submit', { action: 'countEdit', id: props.count.id, version: props.count.version, lines: props.count.lines.map(l => ({ productId: l.productId, counted: amounts[l.productId] ?? '', ...(!props.activated && costs[l.productId] !== undefined ? { unitCost: String(costs[l.productId]), costCurrency: currencies[l.productId] } : {}) })) })
}
function action(value: 'countSubmit' | 'countApply' | 'countRefresh' | 'countCancel') {
  emit('submit', { action: value, id: props.count.id, version: props.count.version })
}
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-muted">
      {{ count.warehouse.name }} · {{ formatDate(count.date) }} · {{ count.reason }}
    </p>
    <UAlert title="Cuenta la existencia física, incluyendo unidades reservadas" description="Guarda las cantidades antes de enviar. Si hubo movimientos, actualiza la base y vuelve a contar las partidas afectadas." color="neutral" />
    <InventoryCountProductPicker
      v-if="canWrite && count.status === 'borrador'"
      :excluded-ids="productIds"
      :busy="busy"
      @add="changeProduct('countAdd', $event)"
    />
    <DefineAmount v-slot="{ line }">
      <UInput
        v-model="amounts[line.productId]"
        :aria-label="`Conteo de ${line.product.name}`"
        inputmode="decimal"
        required
        :disabled="!canWrite || count.status !== 'borrador' || busy"
        class="w-full md:w-36"
      />
    </DefineAmount>
    <DefineCost v-slot="{ line }">
      <div class="flex gap-2">
        <UInputNumber
          v-model="costs[line.productId]"
          :aria-label="`Costo unitario de ${line.product.name}`"
          :min="0"
          :max="999999999"
          :step-snapping="false"
          :format-options="{ maximumFractionDigits: 6 }"
          :increment="false"
          :decrement="false"
          :disabled="!canWrite || count.status !== 'borrador' || busy"
          placeholder="0.00"
          class="min-w-0 flex-1 md:w-44"
        />
        <USelect
          v-model="currencies[line.productId]"
          :items="['MXN', 'USD']"
          :aria-label="`Moneda de ${line.product.name}`"
          :disabled="!canWrite || count.status !== 'borrador' || busy"
        />
      </div>
    </DefineCost>
    <DefineRemove v-slot="{ line }">
      <UButton
        icon="i-lucide-x"
        :aria-label="`Quitar ${line.product.name} del conteo`"
        color="neutral"
        variant="ghost"
        :disabled="busy"
        @click="changeProduct('countRemove', line.productId)"
      />
    </DefineRemove>
    <form class="space-y-4" @submit.prevent="save">
      <DetailTable
        v-if="desktop"
        :data="count.lines"
        :columns="columns"
        :get-row-id="line => line.productId"
        sticky
        class="max-h-[50vh] overflow-auto rounded-lg border border-default"
        :ui="{ thead: 'bg-elevated', td: 'p-3', th: 'p-3' }"
      >
        <template #counted-cell="{ row }">
          <AmountInput :line="row.original" />
        </template>
        <template #cost-cell="{ row }">
          <CostInputs :line="row.original" />
        </template>
        <template #actions-cell="{ row }">
          <RemoveButton :line="row.original" />
        </template>
        <template #empty>
          <p class="p-8 text-center text-muted">
            Agrega los productos que vas a contar. Solo esas partidas formarán parte del conteo.
          </p>
        </template>
      </DetailTable>
      <div v-else class="space-y-3">
        <ListRecordCard
          v-for="line in count.lines"
          :key="line.productId"
          :title="line.product.name"
          :eyebrow="line.product.code"
          :fields="[{ label: 'Esperado', value: line.expected }]"
        >
          <template v-if="canWrite && count.status === 'borrador'" #actions>
            <RemoveButton :line="line" />
          </template>
          <template #footer>
            <div class="space-y-3">
              <UFormField label="Conteo físico">
                <AmountInput :line="line" />
              </UFormField>
              <UFormField v-if="!activated" label="Costo unitario (con impuestos)">
                <CostInputs :line="line" />
              </UFormField>
            </div>
          </template>
        </ListRecordCard>
        <UEmpty
          v-if="!count.lines.length"
          title="Sin partidas"
          description="Agrega los productos que vas a contar. Solo esas partidas formarán parte del conteo."
          variant="naked"
        />
      </div>
      <UButton
        v-if="canWrite && count.status === 'borrador' && count.lines.length"
        type="submit"
        label="Guardar cantidades"
        :loading="busy"
      />
    </form>
    <div v-if="!closed" class="flex flex-wrap gap-2">
      <UButton
        v-if="canWrite && count.status === 'borrador'"
        label="Enviar para aprobación"
        :disabled="busy || !canSubmit"
        @click="action('countSubmit')"
      /><UButton
        v-if="admin && count.status === 'pendiente'"
        label="Aprobar y aplicar ajuste"
        :loading="busy"
        @click="action('countApply')"
      /><UButton
        label="Actualizar base y recontar"
        variant="outline"
        color="neutral"
        :disabled="busy || !count.lines.length"
        @click="action('countRefresh')"
      /><UButton
        label="Cancelar conteo"
        color="error"
        variant="ghost"
        :disabled="busy"
        @click="action('countCancel')"
      />
    </div>
  </div>
</template>
