<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import * as z from 'zod'
import type { SiigoCustomer, SiigoCustomerMutationInput } from '~/types/siigo'
import { SAT_FISCAL_REGIMES } from '~/utils/satFiscalRegimes'
import { siigoCustomerMutationInput } from '~/utils/siigoCustomerMutation'
import { normalizeSiigoMexicoCityCode, siigoMexicoCityOptions } from '~/utils/siigoMexicoCities'
import { SIIGO_MEXICO_COUNTRY_CODE } from '~/utils/siigoMexicoCountry'
import { normalizeSiigoMexicoStateCode, SIIGO_MEXICO_STATES } from '~/utils/siigoMexicoStates'

const props = withDefaults(defineProps<{
  customer: SiigoCustomer
  saving?: boolean
  errorMessage?: string
  activeOverride?: boolean
  notice?: string
  invoiceMode?: boolean
}>(), {
  saving: false,
  errorMessage: '',
  activeOverride: undefined,
  notice: '',
  invoiceMode: false
})

const emit = defineEmits<{
  submit: [input: SiigoCustomerMutationInput]
  cancel: []
}>()

const RFC_MORAL_PATTERN = /^[A-ZÑ&]{3}\d{6}[A-ZÑ0-9]{3}$/
const RFC_PHYSICAL_PATTERN = /^[A-ZÑ&]{4}\d{6}[A-ZÑ0-9]{3}$/
const optionalInteger = z.string().trim().refine(
  value => value === '' || /^\d+$/.test(value),
  'Usa un número entero.'
)

const schema = z.object({
  personType: z.enum(['Physical', 'Moral', 'Foreign']),
  nombres: z.string().trim().max(100),
  apellidos: z.string().trim().max(100),
  razonSocial: z.string().trim().max(100),
  rfcId: z.string().trim().min(1, 'Escribe el RFC.').max(13),
  commercialName: z.string().trim().max(100),
  branchOffice: optionalInteger.refine(value => value === '' || Number(value) <= 999, 'La sucursal debe estar entre 0 y 999.'),
  fiscalRegime: z.string().trim().refine(value => value === '' || /^\d{3}$/.test(value), 'Usa un código SAT de 3 dígitos.'),
  active: z.boolean(),
  email: z.string().trim().max(100).refine(value => value === '' || z.email().safeParse(value).success, 'Escribe un correo válido.'),
  phone: z.string().trim().refine(value => value === '' || /^\d{10}$/.test(value), 'Usa un número telefónico de 10 dígitos.'),
  comments: z.string().trim().max(4000),
  sellerId: optionalInteger,
  collectorId: optionalInteger,
  street: z.string().trim().min(1, 'Escribe la calle.').max(256),
  exteriorNumber: z.string().trim().max(20),
  interiorNumber: z.string().trim().max(20),
  colony: z.string().trim(),
  locality: z.string().trim().max(20),
  postalCode: z.string().trim().refine(value => value === '' || /^\d{5}$/.test(value), 'Usa un código postal de 5 dígitos.'),
  countryCode: z.string().trim().min(1, 'Indica el código de país.').max(5),
  stateCode: z.string().refine(
    value => SIIGO_MEXICO_STATES.some(state => state.value === value),
    'Selecciona un estado.'
  ),
  cityCode: z.string(),
  internalCode: z.string().trim().max(64),
  internalNotes: z.string().trim().max(4000),
  internalTags: z.string().trim().max(1000)
}).superRefine((data, ctx) => {
  const rfc = data.rfcId.toUpperCase()
  if (data.personType === 'Physical') {
    if (!data.nombres) ctx.addIssue({ code: 'custom', path: ['nombres'], message: 'Escribe los nombres.' })
    if (!data.apellidos) ctx.addIssue({ code: 'custom', path: ['apellidos'], message: 'Escribe los apellidos.' })
    if (!RFC_PHYSICAL_PATTERN.test(rfc)) {
      ctx.addIssue({ code: 'custom', path: ['rfcId'], message: 'El RFC de persona física debe tener 13 caracteres.' })
    }
  } else {
    if (!data.razonSocial) ctx.addIssue({ code: 'custom', path: ['razonSocial'], message: 'Escribe la razón social.' })
    if (data.personType === 'Moral' && !RFC_MORAL_PATTERN.test(rfc)) {
      ctx.addIssue({ code: 'custom', path: ['rfcId'], message: 'El RFC de persona moral debe tener 12 caracteres.' })
    }
  }

  if (!normalizeSiigoMexicoCityCode(data.stateCode, data.cityCode)) {
    ctx.addIssue({ code: 'custom', path: ['cityCode'], message: 'Selecciona una ciudad del estado.' })
  }
  if (props.invoiceMode) {
    if (!data.active) {
      ctx.addIssue({ code: 'custom', path: ['active'], message: 'El cliente debe estar activo para facturar.' })
    }
    if (!data.fiscalRegime) {
      ctx.addIssue({ code: 'custom', path: ['fiscalRegime'], message: 'Selecciona el régimen fiscal.' })
    }
    if (!/^\d{5}$/.test(data.postalCode)) {
      ctx.addIssue({ code: 'custom', path: ['postalCode'], message: 'El código postal fiscal debe tener 5 dígitos.' })
    }
  }

  const tags = data.internalTags.split(',').map(tag => tag.trim()).filter(Boolean)
  if (tags.length > 20) ctx.addIssue({ code: 'custom', path: ['internalTags'], message: 'Usa máximo 20 etiquetas.' })
  if (tags.some(tag => tag.length > 40)) ctx.addIssue({ code: 'custom', path: ['internalTags'], message: 'Cada etiqueta admite máximo 40 caracteres.' })
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  personType: 'Physical',
  nombres: '',
  apellidos: '',
  razonSocial: '',
  rfcId: '',
  commercialName: '',
  branchOffice: '',
  fiscalRegime: '',
  active: true,
  email: '',
  phone: '',
  comments: '',
  sellerId: '',
  collectorId: '',
  street: '',
  exteriorNumber: '',
  interiorNumber: '',
  colony: '',
  locality: '',
  postalCode: '',
  countryCode: SIIGO_MEXICO_COUNTRY_CODE,
  stateCode: '',
  cityCode: '',
  internalCode: '',
  internalNotes: '',
  internalTags: ''
})
const initialState = shallowRef('')

const personTypeOptions = [
  { label: 'Persona física', value: 'Physical' },
  { label: 'Persona moral', value: 'Moral' },
  { label: 'Extranjero', value: 'Foreign' }
]
const isPhysical = computed(() => state.personType === 'Physical')
const cityOptions = computed(() => siigoMexicoCityOptions(state.stateCode))
const hasChanges = computed(() => JSON.stringify(state) !== initialState.value)

watch(() => [props.customer, props.activeOverride] as const, () => {
  const input = siigoCustomerMutationInput(props.customer, { active: props.activeOverride })
  const stateCode = normalizeSiigoMexicoStateCode(input.address.city.stateCode)
  Object.assign(state, {
    personType: input.personType,
    nombres: input.personType === 'Physical' ? input.name[0] || '' : '',
    apellidos: input.personType === 'Physical' ? input.name[1] || '' : '',
    razonSocial: input.personType === 'Physical' ? '' : input.name.join(' '),
    rfcId: input.rfcId,
    commercialName: input.commercialName || '',
    branchOffice: input.branchOffice == null ? '' : String(input.branchOffice),
    fiscalRegime: input.fiscalRegime || '',
    active: input.active ?? true,
    email: input.email || '',
    phone: normalizePhone(input.phone),
    comments: input.comments || '',
    sellerId: input.sellerId == null ? '' : String(input.sellerId),
    collectorId: input.collectorId == null ? '' : String(input.collectorId),
    street: input.address.street,
    exteriorNumber: input.address.exteriorNumber || '',
    interiorNumber: input.address.interiorNumber || '',
    colony: input.address.colony || '',
    locality: input.address.locality || '',
    postalCode: input.address.postalCode || '',
    countryCode: SIIGO_MEXICO_COUNTRY_CODE,
    stateCode,
    cityCode: normalizeSiigoMexicoCityCode(stateCode, input.address.city.cityCode),
    internalCode: input.internal?.code || '',
    internalNotes: input.internal?.notes || '',
    internalTags: input.internal?.tags.join(', ') || ''
  })
  initialState.value = JSON.stringify(state)
}, { immediate: true })

function optional(value: string) {
  return value.trim() || undefined
}

function optionalNumber(value: string) {
  return value === '' ? undefined : Number(value)
}

function normalizePhone(value: string | number | null | undefined) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 10)
}

function onPhoneInput(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return

  const normalized = normalizePhone(input.value)
  input.value = normalized
  state.phone = normalized
}

function updateStateCode(value: string | undefined) {
  const stateCode = normalizeSiigoMexicoStateCode(value)
  if (state.stateCode === stateCode) return

  state.stateCode = stateCode
  state.cityCode = ''
}

function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!hasChanges.value) return

  const data = event.data
  emit('submit', {
    personType: data.personType,
    name: data.personType === 'Physical'
      ? [data.nombres.toUpperCase(), data.apellidos.toUpperCase()]
      : [data.razonSocial.toUpperCase()],
    rfcId: data.rfcId.toUpperCase(),
    commercialName: optional(data.commercialName),
    branchOffice: optionalNumber(data.branchOffice),
    fiscalRegime: optional(data.fiscalRegime),
    active: data.active,
    email: optional(data.email),
    phone: optional(data.phone),
    comments: optional(data.comments),
    sellerId: optionalNumber(data.sellerId),
    collectorId: optionalNumber(data.collectorId),
    internal: {
      code: optional(data.internalCode),
      notes: optional(data.internalNotes),
      tags: [...new Set(data.internalTags.split(',').map(tag => tag.trim()).filter(Boolean))]
    },
    address: {
      street: data.street,
      exteriorNumber: optional(data.exteriorNumber),
      interiorNumber: optional(data.interiorNumber),
      colony: optional(data.colony),
      locality: optional(data.locality),
      postalCode: optional(data.postalCode),
      city: {
        countryCode: data.countryCode,
        stateCode: data.stateCode,
        cityCode: data.cityCode
      }
    }
  })
}
</script>

<template>
  <UForm
    :schema="schema"
    :state="state"
    class="space-y-6"
    @submit="onSubmit"
  >
    <UAlert
      v-if="notice"
      color="warning"
      variant="subtle"
      title="Completa los datos requeridos"
      :description="notice"
      icon="i-lucide-triangle-alert"
    />
    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      title="No se pudo guardar el cliente"
      :description="errorMessage"
      icon="i-lucide-circle-alert"
    />

    <UCard>
      <template #header>
        <h2 class="font-semibold text-highlighted">
          Información fiscal y de contacto
        </h2>
      </template>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField
          label="Tipo de persona"
          name="personType"
          required
          class="sm:col-span-2"
        >
          <URadioGroup
            v-model="state.personType"
            :items="personTypeOptions"
            orientation="horizontal"
            :disabled="saving"
          />
        </UFormField>
        <template v-if="isPhysical">
          <UFormField label="Nombres" name="nombres" required>
            <UInput v-model="state.nombres" class="w-full uppercase" :disabled="saving" />
          </UFormField>
          <UFormField label="Apellidos" name="apellidos" required>
            <UInput v-model="state.apellidos" class="w-full uppercase" :disabled="saving" />
          </UFormField>
        </template>
        <UFormField
          v-else
          label="Razón social"
          name="razonSocial"
          required
          class="sm:col-span-2"
        >
          <UInput v-model="state.razonSocial" class="w-full uppercase" :disabled="saving" />
        </UFormField>
        <UFormField label="RFC" name="rfcId" required>
          <UInput
            v-model="state.rfcId"
            class="w-full uppercase"
            maxlength="13"
            :disabled="saving"
          />
        </UFormField>
        <UFormField label="Nombre comercial" name="commercialName">
          <UInput v-model="state.commercialName" class="w-full" :disabled="saving" />
        </UFormField>
        <UFormField label="Régimen fiscal" name="fiscalRegime">
          <USelectMenu
            v-model="state.fiscalRegime"
            :items="SAT_FISCAL_REGIMES"
            value-key="value"
            :search-input="{ placeholder: 'Buscar por código o régimen' }"
            placeholder="Sin especificar"
            clear
            class="w-full"
            :disabled="saving"
          />
        </UFormField>
        <UFormField label="Sucursal" name="branchOffice">
          <UInput
            v-model="state.branchOffice"
            type="number"
            min="0"
            max="999"
            class="w-full"
            :disabled="saving"
          />
        </UFormField>
        <UFormField label="Correo" name="email">
          <UInput
            v-model="state.email"
            type="email"
            class="w-full"
            :disabled="saving"
          />
        </UFormField>
        <UFormField label="Teléfono" name="phone">
          <UInput
            :model-value="state.phone"
            type="tel"
            inputmode="numeric"
            autocomplete="tel-national"
            maxlength="10"
            pattern="[0-9]{10}"
            placeholder="6641234567"
            class="w-full"
            :disabled="saving"
            @input="onPhoneInput"
          />
        </UFormField>
        <UFormField name="active" class="sm:col-span-2">
          <USwitch v-model="state.active" label="Cliente activo en Siigo" :disabled="saving" />
        </UFormField>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold text-highlighted">
          Dirección
        </h2>
      </template>
      <div class="grid gap-4 sm:grid-cols-3">
        <UFormField
          label="Calle"
          name="street"
          required
        >
          <UInput v-model="state.street" class="w-full" :disabled="saving" />
        </UFormField>
        <UFormField label="Número exterior" name="exteriorNumber">
          <UInput v-model="state.exteriorNumber" class="w-full" :disabled="saving" />
        </UFormField>
        <UFormField label="Número interior" name="interiorNumber">
          <UInput v-model="state.interiorNumber" class="w-full" :disabled="saving" />
        </UFormField>
        <UFormField label="Colonia" name="colony">
          <UInput v-model="state.colony" class="w-full" :disabled="saving" />
        </UFormField>
        <UFormField label="Localidad" name="locality">
          <UInput v-model="state.locality" class="w-full" :disabled="saving" />
        </UFormField>
        <UFormField label="Código postal" name="postalCode">
          <UInput
            v-model="state.postalCode"
            class="w-full"
            maxlength="5"
            :disabled="saving"
          />
        </UFormField>
        <UFormField label="Estado" name="stateCode" required>
          <USelectMenu
            :model-value="state.stateCode"
            :items="SIIGO_MEXICO_STATES"
            value-key="value"
            :search-input="{ placeholder: 'Buscar por código o estado' }"
            placeholder="Selecciona un estado"
            class="w-full"
            :disabled="saving"
            @update:model-value="updateStateCode"
          />
        </UFormField>
        <UFormField label="Ciudad" name="cityCode" required>
          <USelectMenu
            v-model="state.cityCode"
            :items="cityOptions"
            value-key="value"
            :search-input="{ placeholder: 'Buscar por código o ciudad' }"
            :placeholder="state.stateCode ? 'Selecciona una ciudad' : 'Selecciona primero un estado'"
            class="w-full"
            :disabled="saving || !state.stateCode"
          />
        </UFormField>
        <UFormField label="Observaciones" name="comments" class="sm:col-span-3">
          <UTextarea
            v-model="state.comments"
            class="w-full"
            :disabled="saving"
            autoresize
          />
        </UFormField>
      </div>
    </UCard>

    <UCard v-if="!invoiceMode">
      <template #header>
        <h2 class="font-semibold text-highlighted">
          Control interno
        </h2>
      </template>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Código interno" name="internalCode">
          <UInput v-model="state.internalCode" class="w-full" :disabled="saving" />
        </UFormField>
        <UFormField label="Etiquetas" name="internalTags" hint="Separadas por comas">
          <UInput v-model="state.internalTags" class="w-full" :disabled="saving" />
        </UFormField>
        <UFormField label="ID vendedor Siigo" name="sellerId">
          <UInput
            v-model="state.sellerId"
            type="number"
            min="1"
            class="w-full"
            :disabled="saving"
          />
        </UFormField>
        <UFormField label="ID cobrador Siigo" name="collectorId">
          <UInput
            v-model="state.collectorId"
            type="number"
            min="1"
            class="w-full"
            :disabled="saving"
          />
        </UFormField>
        <UFormField label="Notas internas" name="internalNotes" class="sm:col-span-2">
          <UTextarea
            v-model="state.internalNotes"
            class="w-full"
            :disabled="saving"
            autoresize
          />
        </UFormField>
      </div>
    </UCard>

    <div class="flex justify-end gap-2 border-t border-default pt-4">
      <UButton
        label="Cancelar"
        color="neutral"
        variant="subtle"
        :disabled="saving"
        @click="emit('cancel')"
      />
      <UButton
        :label="invoiceMode ? 'Guardar y continuar' : 'Guardar cambios'"
        icon="i-lucide-save"
        type="submit"
        :loading="saving"
        :disabled="saving || !hasChanges"
      />
    </div>
  </UForm>
</template>
