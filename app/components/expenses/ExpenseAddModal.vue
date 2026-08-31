<script setup lang="ts">
import { parseDate } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CreateExpenseInput } from '~/types/expenses'
import type { SiigoCustomer } from '~/types/siigo'
import type { ExpenseCategory, ExpenseCurrencyCode } from '~/utils/expense'
import { EXPENSE_CATEGORIES, EXPENSE_CURRENCIES } from '~/utils/expense'
import type { PaymentMethodKey } from '~/utils/orderPayment'
import { PAYMENT_METHOD_KEYS, PAYMENT_METHODS } from '~/utils/orderPayment'
import { mexicoToday } from '~/utils/datetime'
import { siigoCustomerName } from '~/utils/siigoCustomer'

const props = withDefaults(defineProps<{
  categories: readonly ExpenseCategory[]
  suppliers: SiigoCustomer[]
  suppliersLoading?: boolean
  suppliersError?: string
  saving?: boolean
  submitError?: string
}>(), {
  suppliersLoading: false,
  suppliersError: '',
  saving: false,
  submitError: ''
})

const emit = defineEmits<{
  submit: [expense: CreateExpenseInput]
}>()

const open = defineModel<boolean>('open', { required: true })

const categoryItems = computed(() => [...props.categories])
const currencyItems = EXPENSE_CURRENCIES.map(currency => ({ ...currency }))
const methodItems = PAYMENT_METHODS.map(method => ({ label: method.label, value: method.key }))
const supplierItems = computed(() => props.suppliers.map(supplier => ({
  label: siigoCustomerName(supplier) || 'Proveedor sin nombre',
  description: supplier.rfc_id || supplier.identification,
  value: supplier.id
})))

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecciona una fecha válida.'),
  category: z.enum(EXPENSE_CATEGORIES as unknown as [ExpenseCategory, ...ExpenseCategory[]]),
  description: z.string().trim().min(3, 'Describe el gasto.').max(250, 'Usa 250 caracteres o menos.'),
  providerId: z.string().uuid('Selecciona un proveedor.'),
  currencyCode: z.enum(
    EXPENSE_CURRENCIES.map(currency => currency.value) as [ExpenseCurrencyCode, ...ExpenseCurrencyCode[]]
  ),
  exchangeRate: z.number().positive('Captura un tipo de cambio mayor a cero.'),
  amount: z.number().positive('Captura un importe mayor a cero.'),
  paymentMethod: z.enum(PAYMENT_METHOD_KEYS as [PaymentMethodKey, ...PaymentMethodKey[]]),
  notes: z.string().trim().max(1000, 'Usa 1000 caracteres o menos.')
})
type Schema = z.output<typeof schema>

function initialState(): Schema {
  return {
    date: mexicoToday(),
    category: 'Compra de materiales',
    description: '',
    providerId: '',
    currencyCode: 'MXN',
    exchangeRate: 1,
    amount: 0,
    paymentMethod: 'efectivo',
    notes: ''
  }
}

const state = reactive<Schema>(initialState())
const expenseDate = computed<DateValue | undefined>({
  get: () => state.date ? parseDate(state.date) : undefined,
  set: (value) => { state.date = value?.toString() ?? '' }
})
const isMexicanPeso = computed(() => state.currencyCode === 'MXN')

watch(open, (isOpen) => {
  if (isOpen) Object.assign(state, initialState())
})

watch(() => state.currencyCode, (currencyCode) => {
  if (currencyCode === 'MXN') state.exchangeRate = 1
})

function onSubmit(event: FormSubmitEvent<Schema>) {
  emit('submit', event.data)
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Agregar gasto"
    description="Registra la información del gasto para incluirlo en el control del negocio."
    :ui="{ content: 'max-w-3xl', footer: 'justify-end' }"
  >
    <template #body>
      <UForm
        id="expense-form"
        :schema="schema"
        :state="state"
        class="grid gap-4 sm:grid-cols-2"
        @submit="onSubmit"
      >
        <UAlert
          v-if="props.submitError"
          color="error"
          variant="subtle"
          title="No se pudo guardar el gasto"
          :description="props.submitError"
          icon="i-lucide-circle-alert"
          class="sm:col-span-2"
        />

        <UFormField name="date" label="Fecha" required>
          <OrdersOrderDatePicker
            v-model="expenseDate"
            placeholder="Seleccionar fecha"
          />
        </UFormField>

        <UFormField name="category" label="Categoría" required>
          <USelectMenu
            v-model="state.category"
            :items="categoryItems"
            placeholder="Seleccionar categoría"
            class="w-full"
          />
        </UFormField>

        <UFormField
          name="description"
          label="Descripción"
          required
          class="sm:col-span-2"
        >
          <UInput
            v-model="state.description"
            placeholder="Ej. Compra de pintura vinílica"
            maxlength="250"
            class="w-full"
          />
        </UFormField>

        <UFormField
          name="providerId"
          label="Proveedor"
          required
          class="sm:col-span-2"
        >
          <USelectMenu
            v-model="state.providerId"
            :items="supplierItems"
            value-key="value"
            :loading="props.suppliersLoading"
            :disabled="props.suppliersLoading || Boolean(props.suppliersError)"
            placeholder="Buscar proveedor por nombre o RFC"
            class="w-full"
          >
            <template #empty>
              No hay proveedores que coincidan con la búsqueda.
            </template>
          </USelectMenu>
          <p v-if="props.suppliersError" class="mt-2 text-sm text-error">
            {{ props.suppliersError }}
          </p>
          <p v-else-if="!props.suppliersLoading && !supplierItems.length" class="mt-2 text-sm text-muted">
            No hay clientes marcados como proveedor en Siigo y PostgreSQL.
          </p>
        </UFormField>

        <UFormField name="currencyCode" label="Tipo de moneda" required>
          <USelect
            v-model="state.currencyCode"
            :items="currencyItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField
          name="exchangeRate"
          label="Tipo de cambio"
          :hint="isMexicanPeso ? 'Fijo para MXN' : undefined"
          required
        >
          <UInputNumber
            v-model="state.exchangeRate"
            :min="0.0001"
            :step="0.0001"
            :disabled="isMexicanPeso"
            class="w-full"
          />
        </UFormField>

        <UFormField name="amount" label="Importe" required>
          <UInputNumber
            v-model="state.amount"
            :min="0.01"
            :step="0.01"
            class="w-full"
          />
        </UFormField>

        <UFormField name="paymentMethod" label="Método de pago" required>
          <USelect
            v-model="state.paymentMethod"
            :items="methodItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField
          name="notes"
          label="Notas"
          hint="Opcional"
          class="sm:col-span-2"
        >
          <UTextarea
            v-model="state.notes"
            :rows="3"
            autoresize
            :maxrows="6"
            maxlength="1000"
            placeholder="Agrega referencias o detalles adicionales"
            class="w-full"
          />
        </UFormField>
      </UForm>
    </template>

    <template #footer="{ close }">
      <UButton
        label="Cancelar"
        color="neutral"
        variant="outline"
        :disabled="props.saving"
        @click="close"
      />
      <UButton
        type="submit"
        form="expense-form"
        label="Guardar gasto"
        icon="i-lucide-save"
        :loading="props.saving"
        :disabled="props.saving"
      />
    </template>
  </UModal>
</template>
