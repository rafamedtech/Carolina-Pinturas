<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { SiigoCustomer } from '~/types/siigo'

const props = withDefaults(defineProps<{
  customers: SiigoCustomer[]
  initialName?: string
}>(), {
  initialName: ''
})

const emit = defineEmits<{
  created: [customer: SiigoCustomer]
}>()

const open = defineModel<boolean>('open', { required: true })

const RFC_MORAL_PATTERN = /^[A-ZÑ&]{3}\d{6}[A-ZÑ0-9]{3}$/
const RFC_PHYSICAL_PATTERN = /^[A-ZÑ&]{4}\d{6}[A-ZÑ0-9]{3}$/
const GENERIC_RFC_PHYSICAL = 'XAXX010101000'
const GENERIC_RFC_FOREIGN = 'XEXX010101000'
const GENERIC_EMAIL_DOMAIN = 'sincorreo.mx'
const MANUAL_CITY = 'manual'

// Siigo exige un correo por contacto; si el cliente no proporciona uno se
// genera a partir del RFC para no bloquear el alta.
function genericEmailFor(rfc: string) {
  return `${rfc.trim().toLowerCase()}@${GENERIC_EMAIL_DOMAIN}`
}

const schema = z.object({
  personType: z.enum(['Physical', 'Moral', 'Foreign']),
  nombres: z.string().trim().max(100),
  apellidos: z.string().trim().max(100),
  razonSocial: z.string().trim().max(100),
  rfcId: z.string().trim().min(1, 'Escribe el RFC.').max(13),
  fiscalRegime: z.string(),
  email: z.string().trim().max(100),
  phone: z.string().trim().max(14),
  street: z.string().trim().min(1, 'Escribe la calle.').max(256),
  exteriorNumber: z.string().trim().max(20),
  interiorNumber: z.string().trim().max(20),
  colony: z.string().trim().max(20),
  postalCode: z.string().trim().max(5),
  cityKey: z.string().min(1, 'Selecciona la ciudad.'),
  countryCode: z.string().trim().max(5),
  stateCode: z.string().trim().max(10),
  cityCode: z.string().trim().max(10)
}).superRefine((data, ctx) => {
  const rfc = data.rfcId.toUpperCase()

  if (data.personType === 'Physical') {
    if (!data.nombres) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nombres'], message: 'Escribe los nombres.' })
    }
    if (!data.apellidos) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['apellidos'], message: 'Escribe los apellidos.' })
    }
    if (!RFC_PHYSICAL_PATTERN.test(rfc)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rfcId'],
        message: 'El RFC de persona física debe tener 13 caracteres (AAAA000000XXX).'
      })
    }
  } else {
    if (!data.razonSocial) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['razonSocial'], message: 'Escribe la razón social.' })
    }
    if (data.personType === 'Moral' && !RFC_MORAL_PATTERN.test(rfc)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rfcId'],
        message: 'El RFC de persona moral debe tener 12 caracteres (AAA000000XXX).'
      })
    }
  }

  if (data.email && !z.string().email().safeParse(data.email).success) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: 'Escribe un correo válido.' })
  }
  if (data.phone && !/^\d{7,10}$/.test(data.phone.replace(/\D/g, ''))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['phone'], message: 'Usa un teléfono de 7 a 10 dígitos.' })
  }
  if (data.postalCode && !/^\d{5}$/.test(data.postalCode)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['postalCode'], message: 'Usa un código postal de 5 dígitos.' })
  }
  if (data.cityKey === MANUAL_CITY) {
    if (!data.countryCode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['countryCode'], message: 'Indica el código de país.' })
    }
    if (!data.stateCode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['stateCode'], message: 'Indica el código de estado.' })
    }
    if (!data.cityCode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cityCode'], message: 'Indica el código de ciudad.' })
    }
  }
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  personType: 'Physical',
  nombres: '',
  apellidos: '',
  razonSocial: '',
  rfcId: '',
  fiscalRegime: '',
  email: '',
  phone: '',
  street: '',
  exteriorNumber: '',
  interiorNumber: '',
  colony: '',
  postalCode: '',
  cityKey: '',
  countryCode: 'MX',
  stateCode: '',
  cityCode: ''
})
const saving = shallowRef(false)
const submitError = shallowRef('')
const toast = useToast()

const personTypeOptions = [
  { label: 'Persona física', value: 'Physical' },
  { label: 'Persona moral', value: 'Moral' },
  { label: 'Extranjero', value: 'Foreign' }
]

// Códigos de régimen fiscal del SAT más comunes por tipo de persona.
const FISCAL_REGIMES_PHYSICAL = [
  { label: '616 · Sin obligaciones fiscales', value: '616' },
  { label: '605 · Sueldos y salarios', value: '605' },
  { label: '606 · Arrendamiento', value: '606' },
  { label: '612 · Actividades empresariales y profesionales', value: '612' },
  { label: '621 · Incorporación fiscal', value: '621' },
  { label: '626 · Régimen simplificado de confianza', value: '626' }
]
const FISCAL_REGIMES_MORAL = [
  { label: '601 · General de Ley Personas Morales', value: '601' },
  { label: '603 · Personas Morales con Fines no Lucrativos', value: '603' },
  { label: '626 · Régimen simplificado de confianza', value: '626' }
]
const fiscalRegimeOptions = computed(() =>
  state.personType === 'Moral' ? FISCAL_REGIMES_MORAL : FISCAL_REGIMES_PHYSICAL
)

const isPhysical = computed(() => state.personType === 'Physical')
const genericRfc = computed(() =>
  state.personType === 'Foreign' ? GENERIC_RFC_FOREIGN : isPhysical.value ? GENERIC_RFC_PHYSICAL : ''
)

// Siigo exige códigos de país/estado/ciudad de su catálogo interno; se derivan
// de los clientes existentes (ordenados por frecuencia) con captura manual como respaldo.
const cityOptions = computed(() => {
  const counts = new Map<string, { label: string, count: number }>()

  for (const customer of props.customers) {
    const city = customer.address?.city
    if (!city?.country_code || !city.state_code || !city.city_code) continue

    const key = `${city.country_code}|${city.state_code}|${city.city_code}`
    const existing = counts.get(key)

    if (existing) {
      existing.count += 1
    } else {
      counts.set(key, {
        label: [city.city_name || `Ciudad ${city.city_code}`, city.state_name].filter(Boolean).join(', '),
        count: 1
      })
    }
  }

  const derived = [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([value, entry]) => ({ label: entry.label, value }))

  return [
    ...derived,
    { label: 'Capturar códigos manualmente', value: MANUAL_CITY }
  ]
})
const manualCity = computed(() => state.cityKey === MANUAL_CITY)

watch(open, (isOpen) => {
  if (!isOpen) return

  submitError.value = ''

  if (props.initialName) {
    if (isPhysical.value && !state.nombres) state.nombres = props.initialName
    if (!isPhysical.value && !state.razonSocial) state.razonSocial = props.initialName
  }
  if (!state.cityKey) {
    state.cityKey = cityOptions.value[0]?.value === MANUAL_CITY
      ? MANUAL_CITY
      : cityOptions.value[0]?.value || MANUAL_CITY
  }
})

watch(() => state.personType, () => {
  state.fiscalRegime = ''
})

function useGenericRfc() {
  if (genericRfc.value) state.rfcId = genericRfc.value
}

function resetForm() {
  Object.assign(state, {
    personType: 'Physical',
    nombres: '',
    apellidos: '',
    razonSocial: '',
    rfcId: '',
    fiscalRegime: '',
    email: '',
    phone: '',
    street: '',
    exteriorNumber: '',
    interiorNumber: '',
    colony: '',
    postalCode: '',
    cityKey: '',
    countryCode: 'MX',
    stateCode: '',
    cityCode: ''
  })
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  saving.value = true
  submitError.value = ''

  const data = event.data
  const [countryCode, stateCode, cityCode] = data.cityKey === MANUAL_CITY
    ? [data.countryCode, data.stateCode, data.cityCode]
    : data.cityKey.split('|')

  try {
    const customer = await $fetch<SiigoCustomer>('/api/siigo/customers', {
      method: 'POST',
      body: {
        personType: data.personType,
        name: data.personType === 'Physical'
          ? [data.nombres.toUpperCase(), data.apellidos.toUpperCase()]
          : [data.razonSocial.toUpperCase()],
        rfcId: data.rfcId.toUpperCase(),
        fiscalRegime: data.fiscalRegime || undefined,
        email: data.email || genericEmailFor(data.rfcId),
        phone: data.phone ? data.phone.replace(/\D/g, '') : undefined,
        address: {
          street: data.street,
          exteriorNumber: data.exteriorNumber || undefined,
          interiorNumber: data.interiorNumber || undefined,
          colony: data.colony || undefined,
          postalCode: data.postalCode || undefined,
          city: { countryCode, stateCode, cityCode }
        }
      }
    })

    toast.add({
      title: 'Cliente creado en Siigo',
      description: `${customer.name?.filter(Boolean).join(' ') || customer.rfc_id} quedó seleccionado en el pedido.`,
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
    emit('created', customer)
    resetForm()
    open.value = false
  } catch (error: unknown) {
    const fetchError = error as { data?: { statusMessage?: string }, message?: string }
    submitError.value = fetchError.data?.statusMessage || fetchError.message || 'Intenta de nuevo.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Nuevo cliente"
    description="El cliente se crea directamente en Siigo y queda seleccionado en el pedido."
  >
    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UAlert
          v-if="submitError"
          color="error"
          variant="subtle"
          title="No se pudo crear el cliente"
          :description="submitError"
          icon="i-lucide-circle-alert"
        />

        <UFormField label="Tipo de persona" name="personType" required>
          <URadioGroup
            v-model="state.personType"
            :items="personTypeOptions"
            orientation="horizontal"
            :disabled="saving"
          />
        </UFormField>

        <div v-if="isPhysical" class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Nombres" name="nombres" required>
            <UInput
              v-model="state.nombres"
              :disabled="saving"
              maxlength="100"
              class="w-full uppercase"
            />
          </UFormField>
          <UFormField label="Apellidos" name="apellidos" required>
            <UInput
              v-model="state.apellidos"
              :disabled="saving"
              maxlength="100"
              class="w-full uppercase"
            />
          </UFormField>
        </div>
        <UFormField
          v-else
          label="Razón social"
          name="razonSocial"
          required
        >
          <UInput
            v-model="state.razonSocial"
            :disabled="saving"
            maxlength="100"
            class="w-full uppercase"
          />
        </UFormField>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="RFC" name="rfcId" required>
            <UInput
              v-model="state.rfcId"
              :disabled="saving"
              maxlength="13"
              class="w-full uppercase"
            />
            <template #hint>
              <UButton
                v-if="genericRfc"
                :label="`Usar ${genericRfc}`"
                color="neutral"
                variant="link"
                size="xs"
                :disabled="saving"
                @click="useGenericRfc"
              />
            </template>
          </UFormField>
          <UFormField label="Régimen fiscal" name="fiscalRegime" hint="Opcional">
            <USelectMenu
              v-model="state.fiscalRegime"
              :items="fiscalRegimeOptions"
              value-key="value"
              :disabled="saving"
              placeholder="Sin especificar"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Correo" name="email" hint="Opcional, se genera uno si se deja vacío">
            <UInput
              v-model="state.email"
              type="email"
              :disabled="saving"
              maxlength="100"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Teléfono" name="phone" hint="Opcional">
            <UInput
              v-model="state.phone"
              :disabled="saving"
              maxlength="14"
              class="w-full"
            />
          </UFormField>
        </div>

        <USeparator label="Dirección" />

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="Calle"
            name="street"
            required
            class="sm:col-span-2"
          >
            <UInput
              v-model="state.street"
              :disabled="saving"
              maxlength="256"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Número exterior" name="exteriorNumber">
            <UInput
              v-model="state.exteriorNumber"
              :disabled="saving"
              maxlength="20"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Número interior" name="interiorNumber">
            <UInput
              v-model="state.interiorNumber"
              :disabled="saving"
              maxlength="20"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Colonia" name="colony">
            <UInput
              v-model="state.colony"
              :disabled="saving"
              maxlength="20"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Código postal" name="postalCode">
            <UInput
              v-model="state.postalCode"
              :disabled="saving"
              maxlength="5"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Ciudad"
            name="cityKey"
            required
            class="sm:col-span-2"
          >
            <USelectMenu
              v-model="state.cityKey"
              :items="cityOptions"
              value-key="value"
              :disabled="saving"
              placeholder="Selecciona la ciudad"
              class="w-full"
            />
          </UFormField>
        </div>

        <div v-if="manualCity" class="grid gap-4 sm:grid-cols-3">
          <UFormField label="Código de país" name="countryCode" required>
            <UInput
              v-model="state.countryCode"
              :disabled="saving"
              maxlength="5"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Código de estado" name="stateCode" required>
            <UInput
              v-model="state.stateCode"
              :disabled="saving"
              maxlength="10"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Código de ciudad" name="cityCode" required>
            <UInput
              v-model="state.cityCode"
              :disabled="saving"
              maxlength="10"
              class="w-full"
            />
          </UFormField>
          <p class="text-xs text-muted sm:col-span-3">
            Los códigos de estado y ciudad son los del catálogo de Siigo Nube
            (Reportes de configuración → Localidad → Países, estados y ciudades).
          </p>
        </div>

        <div class="flex justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            :disabled="saving"
            @click="open = false"
          />
          <UButton
            label="Crear cliente"
            color="primary"
            variant="solid"
            type="submit"
            :loading="saving"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
