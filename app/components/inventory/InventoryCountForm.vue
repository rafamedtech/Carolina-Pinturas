<script setup lang="ts">
import type { InventoryCount } from '#shared/types/inventory'
import type { InventoryCommand } from '#shared/schemas/inventory'
import { formatDate } from '~/utils/datetime'

const props = defineProps<{ count: InventoryCount, admin: boolean, busy: boolean, activated?: boolean }>()
const emit = defineEmits<{ submit: [command: InventoryCommand['command']] }>()
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
const closed = computed(() => ['aplicado', 'cancelado'].includes(props.count.status))
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
      v-if="count.status === 'borrador'"
      :excluded-ids="productIds"
      :busy="busy"
      @add="changeProduct('countAdd', $event)"
    />
    <form class="space-y-4" @submit.prevent="save">
      <div class="max-h-[50vh] overflow-auto rounded-lg border border-default">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-elevated text-left">
            <tr>
              <th class="p-3">
                Producto
              </th><th class="p-3 text-right">
                Esperado
              </th><th class="p-3">
                Conteo físico
              </th><th v-if="!activated" class="p-3">
                Costo unitario (con impuestos)
              </th><th v-if="count.status === 'borrador'" class="p-3">
                <span class="sr-only">Acciones</span>
              </th>
            </tr>
          </thead><tbody class="divide-y divide-default">
            <tr v-for="line in count.lines" :key="line.productId">
              <td class="p-3">
                {{ line.product.code }} · {{ line.product.name }}
              </td><td class="p-3 text-right font-mono">
                {{ line.expected }}
              </td><td class="p-3">
                <UInput
                  v-model="amounts[line.productId]"
                  :aria-label="`Conteo de ${line.product.name}`"
                  inputmode="decimal"
                  required
                  :disabled="count.status !== 'borrador' || busy"
                  class="w-36"
                />
              </td><td v-if="!activated" class="p-3">
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
                    :disabled="count.status !== 'borrador' || busy"
                    placeholder="0.00"
                    class="w-44"
                  />
                  <USelect
                    v-model="currencies[line.productId]"
                    :items="['MXN', 'USD']"
                    :aria-label="`Moneda de ${line.product.name}`"
                    :disabled="count.status !== 'borrador' || busy"
                  />
                </div>
              </td><td v-if="count.status === 'borrador'" class="p-3">
                <UButton
                  icon="i-lucide-x"
                  :aria-label="`Quitar ${line.product.name} del conteo`"
                  color="neutral"
                  variant="ghost"
                  :disabled="busy"
                  @click="changeProduct('countRemove', line.productId)"
                />
              </td>
            </tr><tr v-if="!count.lines.length">
              <td :colspan="(count.status === 'borrador' ? 4 : 3) + (activated ? 0 : 1)" class="p-8 text-center text-muted">
                Agrega los productos que vas a contar. Solo esas partidas formarán parte del conteo.
              </td>
            </tr>
          </tbody>
        </table>
      </div><UButton
        v-if="count.status === 'borrador' && count.lines.length"
        type="submit"
        label="Guardar cantidades"
        :loading="busy"
      />
    </form>
    <div v-if="!closed" class="flex flex-wrap gap-2">
      <UButton
        v-if="count.status === 'borrador'"
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
