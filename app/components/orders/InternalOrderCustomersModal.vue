<script setup lang="ts">
import { siigoCustomerName } from '~/utils/siigoCustomer'

const emit = defineEmits<{
  saved: []
}>()

const open = defineModel<boolean>('open', { required: true })
const search = shallowRef('')
const selectedIds = shallowRef<string[]>([])
const initialized = shallowRef(false)
const saving = shallowRef(false)
const submitError = shallowRef('')
const toast = useToast()
const { data, status, error, refreshing, refresh } = useCustomersCatalog()

const customers = computed(() => (data.value?.results ?? [])
  .filter(customer => customer.active !== false)
  .sort((left, right) => (siigoCustomerName(left) ?? '').localeCompare(siigoCustomerName(right) ?? '', 'es-MX')))
const normalizedSearch = computed(() => search.value.trim().toLocaleLowerCase('es-MX'))
const filteredCustomers = computed(() => {
  if (!normalizedSearch.value) return customers.value

  return customers.value.filter((customer) => {
    const searchable = [
      siigoCustomerName(customer),
      customer.rfc_id,
      customer.identification
    ].filter(Boolean).join(' ').toLocaleLowerCase('es-MX')
    return searchable.includes(normalizedSearch.value)
  })
})
const loading = computed(() => status.value === 'pending')
const loadError = computed(() => error.value?.data?.statusMessage || '')

watch(open, (isOpen) => {
  if (isOpen) {
    search.value = ''
    submitError.value = ''
    initialized.value = false
    return
  }

  initialized.value = false
})

watch([open, data], ([isOpen, catalog]) => {
  if (!isOpen || !catalog || initialized.value) return
  selectedIds.value = catalog.results
    .filter(customer => customer.active !== false && customer.internal?.internal_orders)
    .map(customer => customer.id)
  initialized.value = true
}, { immediate: true })

function toggleCustomer(customerId: string, selected: boolean) {
  selectedIds.value = selected
    ? [...new Set([...selectedIds.value, customerId])]
    : selectedIds.value.filter(id => id !== customerId)
}

async function refreshFromSiigo() {
  submitError.value = ''

  try {
    await refresh()
  } catch (refreshError: unknown) {
    submitError.value = (refreshError as { data?: { statusMessage?: string } }).data?.statusMessage
      || 'No fue posible recargar los clientes desde Siigo.'
  }
}

async function save() {
  saving.value = true
  submitError.value = ''

  try {
    await $fetch('/api/internal-order-customers', {
      method: 'PUT',
      body: { customerIds: selectedIds.value }
    })

    if (data.value) {
      data.value = {
        ...data.value,
        results: data.value.results.map(customer => ({
          ...customer,
          internal: customer.internal
            ? { ...customer.internal, internal_orders: selectedIds.value.includes(customer.id) }
            : customer.internal
        }))
      }
    }

    toast.add({
      title: 'Clientes actualizados',
      description: `${selectedIds.value.length} ${selectedIds.value.length === 1 ? 'cliente aplica' : 'clientes aplican'} a pedidos internos.`,
      color: 'success'
    })
    emit('saved')
    open.value = false
  } catch (saveError: unknown) {
    submitError.value = (saveError as { data?: { statusMessage?: string } }).data?.statusMessage
      || 'No fue posible guardar la selección.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Gestionar clientes de pedidos internos"
    description="Selecciona clientes existentes. Sus pedidos aparecerán en esta vista sin dejar de mostrarse en Ventas."
    :dismissible="!saving"
    :ui="{ content: 'max-w-2xl', footer: 'justify-between' }"
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          v-if="submitError || loadError"
          color="error"
          variant="subtle"
          title="No se pudo gestionar la selección"
          :description="submitError || loadError"
          icon="i-lucide-circle-alert"
        />

        <div class="flex flex-wrap items-center justify-between gap-3">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Buscar por nombre o RFC"
            class="min-w-0 flex-1 sm:min-w-80"
          />
          <UButton
            label="Recargar Siigo"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :loading="refreshing"
            :disabled="saving || refreshing"
            :ui="{ label: 'hidden sm:inline' }"
            @click="refreshFromSiigo"
          />
          <UBadge
            :label="`${selectedIds.length} seleccionados`"
            color="primary"
            variant="subtle"
          />
        </div>

        <div class="max-h-[26rem] overflow-y-auto rounded-lg border border-default">
          <div v-if="loading" class="space-y-3 p-4">
            <USkeleton v-for="index in 6" :key="index" class="h-12 w-full" />
          </div>

          <div v-else-if="filteredCustomers.length" class="divide-y divide-default">
            <label
              v-for="customer in filteredCustomers"
              :key="customer.id"
              class="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-elevated/60"
            >
              <UCheckbox
                :model-value="selectedIds.includes(customer.id)"
                :disabled="saving"
                class="mt-0.5"
                @update:model-value="toggleCustomer(customer.id, Boolean($event))"
              />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-highlighted">
                  {{ siigoCustomerName(customer) || 'Cliente sin nombre' }}
                </span>
                <span class="mt-0.5 block truncate text-xs text-muted">
                  {{ customer.rfc_id || customer.identification || 'Sin RFC registrado' }}
                </span>
              </span>
            </label>
          </div>

          <UEmpty
            v-else
            icon="i-lucide-user-search"
            title="No hay clientes que coincidan"
            description="Prueba con otro nombre o RFC."
            class="py-12"
          />
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <p class="hidden text-sm text-muted sm:block">
        {{ customers.length }} clientes disponibles
      </p>
      <div class="flex w-full justify-end gap-2 sm:w-auto">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="outline"
          :disabled="saving"
          @click="close"
        />
        <UButton
          label="Guardar selección"
          icon="i-lucide-save"
          :loading="saving"
          :disabled="loading || Boolean(loadError) || saving"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
