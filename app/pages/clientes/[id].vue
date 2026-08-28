<script setup lang="ts">
import type { SiigoCustomer, SiigoCustomerMutationInput } from '~/types/siigo'
import { SAT_FISCAL_REGIMES } from '~/utils/satFiscalRegimes'
import { siigoCustomerPhone, siigoCustomerAddress } from '~/utils/siigoCustomer'
import { missingSiigoCustomerFields, siigoCustomerMutationInput } from '~/utils/siigoCustomerMutation'

const route = useRoute()
const toast = useToast()
const customerId = computed(() => String(route.params.id))
const { data: customer, status, error, refresh } = useLazyFetch<SiigoCustomer>(
  () => `/api/siigo/customers/${encodeURIComponent(customerId.value)}`,
  { key: () => `siigo-customer-${customerId.value}` }
)

const fullName = computed(() => customer.value?.name?.filter(Boolean).join(' ') || 'Cliente')
const contact = computed(() => customer.value?.contacts?.[0])
const email = computed(() => contact.value?.email || '—')
const phone = computed(() => siigoCustomerPhone(customer.value) || '—')
const address = computed(() => siigoCustomerAddress(customer.value) || '—')
const personTypeLabel = computed(() => {
  const personType = customer.value?.person_type?.trim()
  if (!personType) return '—'

  return {
    physical: 'Persona física',
    moral: 'Persona moral',
    foreign: 'Extranjero'
  }[personType.toLowerCase()] || personType
})
const fiscalRegimeLabel = computed(() => {
  const fiscalRegime = customer.value?.fiscal_regime?.trim()
  if (!fiscalRegime) return '—'

  return SAT_FISCAL_REGIMES.find(regime => regime.value === fiscalRegime)?.label || fiscalRegime
})
const customerSince = computed(() => {
  const created = customer.value?.metadata?.created
  return created ? formatMexicoDate(created) : '—'
})
const message = computed(() => error.value?.data?.statusMessage || 'No fue posible cargar el cliente.')
const editing = shallowRef(false)
const saving = shallowRef(false)
const submitError = shallowRef('')
const editNotice = shallowRef('')
const activeOverride = shallowRef<boolean | undefined>(undefined)
const archiveOpen = shallowRef(false)

function startEditing(options: { active?: boolean, notice?: string } = {}) {
  activeOverride.value = options.active
  editNotice.value = options.notice || ''
  submitError.value = ''
  editing.value = true
}

function cancelEditing() {
  editing.value = false
  activeOverride.value = undefined
  editNotice.value = ''
  submitError.value = ''
}

async function saveCustomer(
  input: SiigoCustomerMutationInput,
  successTitle = 'Cliente actualizado'
) {
  if (saving.value) return
  saving.value = true
  submitError.value = ''

  try {
    const updated = await $fetch<SiigoCustomer>(
      `/api/siigo/customers/${encodeURIComponent(customerId.value)}`,
      { method: 'PUT', body: input }
    )
    customer.value = updated
    cancelEditing()
    archiveOpen.value = false
    await refreshNuxtData('customers-catalog-request')
    toast.add({
      title: successTitle,
      description: 'Los datos vigentes quedaron guardados en Siigo.',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (fetchError: unknown) {
    const response = fetchError as { data?: { statusMessage?: string }, message?: string }
    submitError.value = response.data?.statusMessage || response.message || 'Intenta nuevamente.'
    toast.add({
      title: 'No se pudo actualizar el cliente',
      description: submitError.value,
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    saving.value = false
  }
}

async function setCustomerActive(active: boolean) {
  if (!customer.value) return
  const input = siigoCustomerMutationInput(customer.value, { active })
  const missing = missingSiigoCustomerFields(input)

  if (missing.length) {
    archiveOpen.value = false
    startEditing({
      active,
      notice: `Para ${active ? 'activar' : 'archivar'} este cliente, completa: ${missing.join(', ')}.`
    })
    return
  }

  await saveCustomer(input, active ? 'Cliente activado' : 'Cliente archivado')
}

useSeoMeta({ title: () => fullName.value })
</script>

<template>
  <UDashboardPanel id="customer-detail">
    <template #header>
      <UDashboardNavbar title="Detalle del cliente">
        <template #leading>
          <UButton
            to="/clientes"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            aria-label="Volver a clientes"
          />
        </template>
        <template #right>
          <UButton
            v-if="!editing"
            label="Actualizar"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :loading="status === 'pending'"
            @click="() => refresh()"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="error"
        color="warning"
        variant="subtle"
        title="Cliente no disponible"
        :description="message"
        icon="i-lucide-plug-zap"
      />

      <template v-else-if="customer">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-xl font-semibold text-primary">
              {{ fullName }}
            </h1>
          </div>
          <UBadge :color="customer.active === false ? 'neutral' : 'success'" variant="subtle" size="lg">
            {{ customer.active === false ? 'Inactivo' : 'Activo' }}
          </UBadge>
        </div>

        <CustomersCustomerEditForm
          v-if="editing"
          :customer="customer"
          :saving="saving"
          :error-message="submitError"
          :active-override="activeOverride"
          :notice="editNotice"
          @submit="saveCustomer"
          @cancel="cancelEditing"
        />

        <div v-else class="grid gap-4 lg:grid-cols-2">
          <UCard>
            <template #header>
              <h2 class="font-semibold text-highlighted">
                Información general
              </h2>
            </template>
            <dl class="grid gap-4 sm:grid-cols-2">
              <div>
                <dt class="text-sm text-muted">
                  RFC
                </dt>
                <dd class="mt-1 font-medium">
                  {{ customer.rfc_id || '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Tipo de cliente
                </dt>
                <dd class="mt-1 font-medium">
                  {{ personTypeLabel }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Régimen fiscal
                </dt>
                <dd class="mt-1 font-medium">
                  {{ fiscalRegimeLabel }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Cliente desde
                </dt>
                <dd class="mt-1 font-medium">
                  {{ customerSince }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Facturación predeterminada
                </dt>
                <dd class="mt-1 font-medium">
                  {{ customer.internal?.requires_invoice ? 'Requiere factura' : 'No requiere factura' }}
                </dd>
              </div>
            </dl>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="font-semibold text-highlighted">
                Contacto
              </h2>
            </template>
            <dl class="grid gap-4">
              <div>
                <dt class="text-sm text-muted">
                  Correo
                </dt>
                <dd class="mt-1 break-all font-medium">
                  {{ email }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Teléfono
                </dt>
                <dd class="mt-1 font-medium">
                  {{ phone }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Dirección
                </dt>
                <dd class="mt-1 font-medium">
                  {{ address }}
                </dd>
              </div>
            </dl>
          </UCard>
        </div>

        <CustomersCustomerOrdersTable
          v-if="!editing"
          :customer-id="customer.id"
        />

        <div v-if="!editing" class="flex flex-wrap gap-2 border-t border-default pt-4">
          <UButton label="Editar cliente" icon="i-lucide-pencil" @click="startEditing()" />
          <UButton
            :label="customer.active === false ? 'Activar cliente' : 'Desactivar cliente'"
            icon="i-lucide-power"
            color="neutral"
            variant="outline"
            :loading="saving"
            @click="setCustomerActive(customer.active === false)"
          />
          <UButton
            v-if="customer.active !== false"
            label="Archivar cliente"
            icon="i-lucide-archive"
            color="error"
            variant="outline"
            :disabled="saving"
            @click="archiveOpen = true"
          />
        </div>

        <UModal
          v-model:open="archiveOpen"
          title="Archivar cliente"
          description="Siigo México no permite eliminar clientes; se desactivará este registro en ambos sistemas."
          :dismissible="!saving"
          :close="saving ? false : undefined"
          :ui="{ footer: 'justify-end' }"
        >
          <template #body>
            <UAlert
              color="warning"
              variant="subtle"
              title="El cliente dejará de estar activo"
              description="Se conservarán su historial y sus datos para pedidos y facturación existentes."
              icon="i-lucide-triangle-alert"
            />
          </template>
          <template #footer>
            <UButton
              label="Conservar activo"
              color="neutral"
              variant="outline"
              :disabled="saving"
              @click="archiveOpen = false"
            />
            <UButton
              label="Archivar cliente"
              color="error"
              icon="i-lucide-archive"
              :loading="saving"
              @click="setCustomerActive(false)"
            />
          </template>
        </UModal>
      </template>

      <div
        v-else-if="status === 'pending'"
        class="flex flex-col gap-6"
        role="status"
        aria-busy="true"
      >
        <div class="flex flex-col gap-2">
          <USkeleton class="h-4 w-24" />
          <USkeleton class="h-7 w-64" />
          <USkeleton class="h-4 w-40" />
        </div>
        <USkeleton class="h-48 w-full rounded-lg" />
        <USkeleton class="h-32 w-full rounded-lg" />
        <span class="sr-only">Cargando cliente…</span>
      </div>
    </template>
  </UDashboardPanel>
</template>
