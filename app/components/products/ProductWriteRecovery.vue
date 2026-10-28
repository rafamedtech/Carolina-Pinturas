<script setup lang="ts">
import type { ProductContext, ProductInput } from '~/types/siigo-products'
import type { SiigoProduct } from '~/types/siigo'

const props = defineProps<{ operationId: string, context: ProductContext, failureMessage?: string }>()
const emit = defineEmits<{
  recovered: [product: SiigoProduct]
  restored: [product: SiigoProduct]
  resolved: [result: { operationIds: string[], input?: ProductInput }]
}>()
const { review, checking, acting, errorMessage, nextCheckAt, refresh, retry, resolve } = useProductWriteRecovery(() => props.operationId)
const confirmation = shallowRef<'retry' | 'edit' | 'discard' | null>(null)
const open = computed({ get: () => confirmation.value !== null, set: (value) => {
  if (!value) confirmation.value = null
} })
const busy = computed(() => checking.value || acting.value)
const heading = computed(() => review.value
  ? ({
      synced: 'Guardado confirmado', reverted: 'Cambios no guardados', different: 'Revisa los cambios pendientes', unavailable: 'Siigo no está disponible',
      local_error: 'Falta completar el guardado interno', closed: 'El intento anterior ya se cerró', missing: 'Revisa el producto en Siigo'
    }[review.value.status])
  : 'No se pudo comprobar el guardado')
const confirmationTitle = computed(() => confirmation.value === 'retry' ? 'Volver a enviar los cambios pendientes' : confirmation.value === 'edit' ? 'Cargar los cambios para corregirlos' : 'Descartar los cambios pendientes')
const confirmationText = computed(() => confirmation.value === 'retry'
  ? 'Se comprobará Siigo otra vez. Si los datos todavía son distintos, se enviarán los datos comerciales y se completarán las opciones internas de «Cambios conservados». El formulario puede contener otras correcciones que no se incluirán.'
  : confirmation.value === 'edit'
    ? 'Se cerrará el intento anterior y sus cambios se cargarán en el formulario para que puedas corregirlos y guardar. Esto reemplaza lo que tengas capturado en el formulario.'
    : 'Se cerrará el intento anterior y se conservarán los datos actuales de Siigo. Los cambios de la columna «Cambios pendientes» no se aplicarán. El registro del intento se conserva.')
watch(review, (value) => {
  if (value?.status === 'synced' && value.product) emit('recovered', value.product)
  if (value?.status === 'reverted' && value.product) emit('restored', value.product)
})
async function confirm() {
  if (confirmation.value === 'retry') {
    const product = await retry()
    if (product) emit('recovered', product)
  } else {
    const result = await resolve(confirmation.value === 'edit')
    if (result) emit('resolved', result)
  }
  confirmation.value = null
}
const labels: Record<string, string> = {
  code: 'Código', name: 'Nombre', account_group: 'Clasificación', type: 'Tipo', active: 'Activo', stock_control: 'Control de inventario en Siigo',
  tax_included: 'IVA incluido', unit: 'Unidad SAT', key: 'Clave SAT', reference: 'Referencia', description: 'Descripción',
  additional_fields: 'Marca y código de barras', taxes: 'Impuestos', prices: 'Precios', availability: 'Disponibilidad interna', composition: 'Composición interna'
}
const pendingFields = computed(() => review.value ? Object.entries(review.value.input).map(([field, value]) => ({ field, label: labels[field] || field, value: display(field, value) })) : [])
function display(field: string, value: unknown): string {
  if (value === undefined || value === null || value === '') return 'Sin valor'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (field === 'type' && value === 'Product') return 'Producto'
  if (field === 'availability' && typeof value === 'object') {
    const availability = value as ProductInput['availability']
    return `Compra: ${availability.purchase ? 'Sí' : 'No'} · Venta directa: ${availability.sale ? 'Sí' : 'No'} · Gasto: ${availability.expense ? 'Sí' : 'No'}`
  }
  if (field === 'composition' && typeof value === 'object') {
    const composition = value as ProductInput['composition']
    return composition.kind === 'product' ? 'Producto simple' : composition.components.map(item => `${review.value?.componentLabels[item.productId] || 'Componente sin referencia en el catálogo'}: ${item.quantity} unidades`).join(' · ')
  }
  if (field === 'account_group') return props.context.accountGroups.find(item => item.id === value)?.name ?? String(value)
  if (field === 'taxes' && Array.isArray(value)) return value.map(id => props.context.taxes.find(item => item.id === id)?.name ?? `Impuesto ${id}`).join(', ') || 'Sin impuestos'
  if (field === 'additional_fields' && typeof value === 'object') {
    const fields = value as { brand?: string, barcode?: string }
    return `Marca: ${fields.brand || 'Sin marca'} · Código de barras: ${fields.barcode || 'Sin valor'}`
  }
  if (field === 'prices' && Array.isArray(value)) {
    return (value as ProductInput['prices']).flatMap(group => group.price_list.map((price) => {
      const name = props.context.priceLists.find(item => item.id === price.position)?.name ?? `Lista ${price.position}`
      const amount = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price.value)
      return `${name}: ${amount} ${group.currency_code}`
    })).join(' · ') || 'Sin precios'
  }
  return String(value)
}
</script>

<template>
  <section
    class="shrink-0 overflow-hidden rounded-xl border border-warning/40 bg-default"
    aria-label="Resolver guardado pendiente"
    aria-live="polite"
    :aria-busy="busy"
  >
    <div class="space-y-4 p-4 sm:p-5">
      <div class="flex items-start gap-3">
        <UIcon :name="checking ? 'i-lucide-loader-circle' : 'i-lucide-circle-alert'" class="mt-0.5 size-5 shrink-0 text-warning" :class="{ 'animate-spin': checking }" />
        <div class="min-w-0 space-y-1">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">
            Guardado pendiente · Paso 1: comprobar · Paso 2: resolver
          </p>
          <h2 class="font-semibold text-highlighted">
            {{ checking && !review ? 'Comprobando el resultado en Siigo…' : heading }}
          </h2>
          <p class="text-sm text-muted">
            {{ review?.message || 'Tus cambios están conservados. Se consulta el resultado sin volver a enviarlos.' }}
          </p>
        </div>
      </div>
      <p v-if="nextCheckAt" class="text-sm text-muted">
        Volveremos a comprobar automáticamente. No necesitas pulsar Guardar otra vez.
      </p>
      <p v-else-if="review?.status === 'unavailable'" class="text-sm text-muted">
        Cuando Siigo responda, pulsa «Comprobar otra vez». Si los datos coinciden, el guardado se completará y el producto se desbloqueará automáticamente.
      </p>
      <div v-if="review?.differences.length" class="overflow-x-auto rounded-lg border border-default">
        <table class="w-full text-left text-sm">
          <caption class="sr-only">
            Comparación de cambios pendientes con los datos actuales de Siigo
          </caption>
          <thead class="bg-elevated/50 text-muted">
            <tr>
              <th class="p-3 font-medium">
                Campo
              </th><th class="p-3 font-medium">
                Actual en Siigo
              </th><th class="p-3 font-medium">
                Cambios pendientes
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="difference in review.differences" :key="difference.field">
              <th scope="row" class="p-3 align-top font-medium">
                {{ labels[difference.field] || difference.field }}
              </th>
              <td class="min-w-36 max-w-sm whitespace-pre-wrap break-words p-3 align-top text-muted">
                {{ display(difference.field, difference.actual) }}
              </td>
              <td class="min-w-36 max-w-sm whitespace-pre-wrap break-words p-3 align-top font-medium">
                {{ display(difference.field, difference.expected) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <details v-if="review" class="rounded-lg border border-default" :open="['unavailable', 'missing', 'closed'].includes(review.status)">
        <summary class="cursor-pointer p-3 text-sm font-medium">
          Cambios conservados
        </summary>
        <dl class="grid gap-3 border-t border-default p-3 text-sm sm:grid-cols-2">
          <div v-for="field in pendingFields" :key="field.field" class="min-w-0">
            <dt class="text-muted">
              {{ field.label }}
            </dt>
            <dd class="mt-1 whitespace-pre-wrap break-words">
              {{ field.value }}
            </dd>
          </div>
        </dl>
      </details>
      <p v-if="review && ['different', 'local_error'].includes(review.status) && !review.canDiscard" class="text-sm text-muted">
        <template v-if="review.isNew">
          Es un alta nueva. Revisa el producto por su código en Siigo y, si quedó incompleto, corrígelo allí. Pulsa «Comprobar otra vez» para terminar el guardado. No crearemos otro producto mientras el resultado sea incierto.
        </template>
        <template v-else>
          El intento puede seguir ejecutándose. Espera hasta {{ formatDateTime(review.availableAt) }} y pulsa «Comprobar otra vez» para habilitar las acciones.
        </template>
      </p>
      <UAlert
        v-if="failureMessage && failureMessage !== errorMessage"
        title="Último error al enviar"
        :description="failureMessage"
        color="error"
        variant="subtle"
        class="shrink-0"
      />
      <UAlert
        v-if="errorMessage"
        :title="errorMessage"
        color="error"
        variant="subtle"
        class="shrink-0"
      />
      <div class="flex flex-wrap gap-2">
        <UButton
          v-if="review?.canRetry"
          label="Volver a enviar cambios pendientes"
          icon="i-lucide-send"
          :disabled="busy"
          @click="confirmation = 'retry'"
        />
        <UButton
          label="Comprobar otra vez"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="outline"
          :loading="checking"
          :disabled="busy"
          @click="refresh()"
        />
        <UButton
          v-if="review?.canDiscard || review?.status === 'closed'"
          label="Cargar cambios para corregirlos"
          color="neutral"
          variant="outline"
          :disabled="busy"
          @click="confirmation = 'edit'"
        />
        <UButton
          v-if="review?.canDiscard"
          label="Descartar cambios pendientes"
          color="neutral"
          variant="ghost"
          :disabled="busy"
          @click="confirmation = 'discard'"
        />
      </div>
      <p class="text-xs text-muted">
        El producto vuelve a estar disponible cuando el guardado se confirma o cuando decides descartar el intento y conservar Siigo.
      </p>
    </div>
    <UModal
      v-model:open="open"
      :title="confirmationTitle"
      :description="confirmationText"
      :dismissible="!acting"
    >
      <template #footer>
        <div class="flex w-full flex-wrap justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            :disabled="acting"
            @click="open = false"
          />
          <UButton
            :label="confirmationTitle"
            :loading="acting"
            :disabled="acting"
            @click="confirm"
          />
        </div>
      </template>
    </UModal>
  </section>
</template>
