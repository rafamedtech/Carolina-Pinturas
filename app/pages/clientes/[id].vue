<script setup lang="ts">
import type { SiigoCustomer } from '~/types/siigo'
import { siigoCustomerPhone, siigoCustomerAddress } from '~/utils/siigoCustomer'

const route = useRoute()
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
const message = computed(() => error.value?.data?.statusMessage || 'No fue posible cargar el cliente.')

useSeoMeta({ title: () => fullName.value })
</script>

<template>
  <UDashboardPanel id="customer-detail">
    <template #header>
      <UDashboardNavbar :title="fullName">
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
            <p class="text-sm text-muted">
              Cliente
            </p>
            <h1 class="text-xl font-semibold text-highlighted">
              {{ fullName }}
            </h1>
            <p class="mt-1 text-sm text-muted">
              {{ customer.rfc_id || '—' }}
            </p>
          </div>
          <UBadge :color="customer.active === false ? 'neutral' : 'success'" variant="subtle" size="lg">
            {{ customer.active === false ? 'Inactivo' : 'Activo' }}
          </UBadge>
        </div>

        <UAlert
          color="neutral"
          variant="subtle"
          title="Gestión de clientes pendiente de habilitación"
          description="Crear, editar, eliminar y activar o desactivar se habilitarán tras validar los endpoints de escritura de Siigo México."
          icon="i-lucide-shield-check"
        />

        <div class="grid gap-4 lg:grid-cols-2">
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
                  {{ customer.person_type || '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Régimen fiscal
                </dt>
                <dd class="mt-1 font-medium">
                  {{ customer.fiscal_regime || '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Tipo de registro
                </dt>
                <dd class="mt-1 font-medium">
                  {{ customer.type || '—' }}
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

        <div class="flex flex-wrap gap-2 border-t border-default pt-4">
          <UButton label="Editar cliente" icon="i-lucide-pencil" disabled />
          <UButton
            :label="customer.active === false ? 'Activar cliente' : 'Desactivar cliente'"
            icon="i-lucide-power"
            color="neutral"
            variant="outline"
            disabled
          />
          <UButton
            label="Eliminar cliente"
            icon="i-lucide-trash-2"
            color="error"
            variant="outline"
            disabled
          />
        </div>
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
