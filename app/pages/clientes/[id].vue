<script setup lang="ts">
import type { SiigoCustomer, SiigoCustomerMutationInput } from '~/types/siigo'
import { SAT_FISCAL_REGIMES } from '~/utils/satFiscalRegimes'
import { siigoCustomerPhone, siigoCustomerAddress } from '~/utils/siigoCustomer'
import { missingSiigoCustomerFields, siigoCustomerMutationInput } from '~/utils/siigoCustomerMutation'
import { canManageOrderLogistics } from '~/utils/roleAccess'

const route = useRoute()
const toast = useToast()
const { user } = useAuth()
const isSupplierContext = route.path.startsWith('/proveedores')
const entityLabel = isSupplierContext ? 'Proveedor' : 'Cliente'
const entityLabelLower = entityLabel.toLowerCase()
const entitiesLabelLower = isSupplierContext ? 'proveedores' : 'clientes'
const collectionPath = isSupplierContext ? '/proveedores' : '/clientes'
const catalogKey = isSupplierContext
  ? 'customers-catalog-request-supplier'
  : 'customers-catalog-request-customer'
const customerId = computed(() => String(route.params.id))
const { data: customer, status, error, refresh } = useLazyFetch<SiigoCustomer>(
  () => `/api/siigo/customers/${encodeURIComponent(customerId.value)}`,
  { key: () => `siigo-customer-${customerId.value}` }
)

const fullName = computed(() => customer.value?.name?.filter(Boolean).join(' ') || entityLabel)
const isExpectedType = computed(() =>
  isSupplierContext
    ? customer.value?.internal?.roles?.supplier === true
    : customer.value?.internal?.roles?.customer === true
)
const canManageRoles = computed(() => user.value ? canManageOrderLogistics(user.value.role) : false)
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
const message = computed(() =>
  error.value?.data?.statusMessage || `No fue posible cargar el ${entityLabelLower}.`
)
const editing = shallowRef(false)
const saving = shallowRef(false)
const submitError = shallowRef('')
const editNotice = shallowRef('')
const activeOverride = shallowRef<boolean | undefined>(undefined)
const archiveOpen = shallowRef(false)
const rolesSaving = shallowRef(false)

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
  successTitle = `${entityLabel} actualizado`
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
    await Promise.all([
      refreshNuxtData(catalogKey),
      refreshNuxtData('customers-catalog-request')
    ])
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
      title: `No se pudo actualizar el ${entityLabelLower}`,
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
      notice: `Para ${active ? 'activar' : 'archivar'} este ${entityLabelLower}, completa: ${missing.join(', ')}.`
    })
    return
  }

  await saveCustomer(input, active ? `${entityLabel} activado` : `${entityLabel} archivado`)
}

async function saveRoles(roles: { customer: boolean, supplier: boolean }) {
  if (!customer.value || rolesSaving.value) return
  rolesSaving.value = true

  try {
    const internal = await $fetch<NonNullable<SiigoCustomer['internal']>>(
      `/api/siigo/customers/${encodeURIComponent(customerId.value)}/roles`,
      { method: 'PATCH', body: roles }
    )
    customer.value = { ...customer.value, internal }
    await Promise.all([
      refreshNuxtData('customers-catalog-request-customer'),
      refreshNuxtData('customers-catalog-request-supplier')
    ])
    toast.add({
      title: 'Roles actualizados',
      description: 'La clasificación local se aplicó a Clientes y Proveedores.',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (fetchError: unknown) {
    const response = fetchError as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'No se pudieron actualizar los roles',
      description: response.data?.statusMessage || response.message || 'Intenta nuevamente.',
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    rolesSaving.value = false
  }
}

useSeoMeta({ title: () => fullName.value })
</script>

<template>
  <UDashboardPanel id="customer-detail">
    <template #header>
      <UDashboardNavbar :title="`Detalle del ${entityLabelLower}`">
        <template #leading>
          <UButton
            :to="collectionPath"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            :aria-label="`Volver a ${collectionPath.slice(1)}`"
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
        :title="`${entityLabel} no disponible`"
        :description="message"
        icon="i-lucide-plug-zap"
      />

      <template v-else-if="customer">
        <UAlert
          v-if="!isExpectedType"
          color="warning"
          variant="subtle"
          :title="`El registro no tiene el rol ${entityLabel}`"
          description="La clasificación local cambió. Vuelve al catálogo correspondiente o actualiza sus roles."
          icon="i-lucide-triangle-alert"
        />

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
                  {{ entityLabel }} desde
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

          <CustomersCustomerRolesCard
            v-if="customer.internal"
            :customer="customer.internal.roles?.customer === true"
            :supplier="customer.internal.roles?.supplier === true"
            :editable="canManageRoles"
            :saving="rolesSaving"
            @save="saveRoles"
          />
        </div>

        <CustomersCustomerOrdersTable
          v-if="!editing"
          :customer-id="customer.id"
        />

        <div v-if="!editing" class="flex flex-wrap gap-2 border-t border-default pt-4">
          <UButton :label="`Editar ${entityLabelLower}`" icon="i-lucide-pencil" @click="startEditing()" />
          <UButton
            :label="customer.active === false ? `Activar ${entityLabelLower}` : `Desactivar ${entityLabelLower}`"
            icon="i-lucide-power"
            color="neutral"
            variant="outline"
            :loading="saving"
            @click="setCustomerActive(customer.active === false)"
          />
          <UButton
            v-if="customer.active !== false"
            :label="`Archivar ${entityLabelLower}`"
            icon="i-lucide-archive"
            color="error"
            variant="outline"
            :disabled="saving"
            @click="archiveOpen = true"
          />
        </div>

        <UModal
          v-model:open="archiveOpen"
          :title="`Archivar ${entityLabelLower}`"
          :description="`Siigo México no permite eliminar ${entitiesLabelLower}; se desactivará este registro en ambos sistemas.`"
          :dismissible="!saving"
          :close="saving ? false : undefined"
          :ui="{ footer: 'justify-end' }"
        >
          <template #body>
            <UAlert
              color="warning"
              variant="subtle"
              :title="`El ${entityLabelLower} dejará de estar activo`"
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
              :label="`Archivar ${entityLabelLower}`"
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
