<script setup lang="ts">
import type { InventoryWarehouse } from '#shared/types/inventory'
import type { InventoryCommand } from '#shared/schemas/inventory'
import { fetchAllPages } from '~/composables/useCsvExport'

const requestFetch = useRequestFetch()
const { data, status, error: loadError, refresh } = useAsyncData('inventory-warehouses', async () => ({ results: await fetchAllPages<InventoryWarehouse>('/api/inventory/warehouses', {}, 100, requestFetch) }), { lazy: true, server: false })
const open = shallowRef(false)
const editing = shallowRef<InventoryWarehouse>()
const { busy, error, run } = useInventoryAction(() => refresh())

function openWarehouse(warehouse?: InventoryWarehouse) {
  editing.value = warehouse
  error.value = ''
  open.value = true
}

async function save(command: InventoryCommand['command']) {
  if (await run(command)) open.value = false
}
</script>

<template>
  <section aria-labelledby="settings-warehouses-title" class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <DetailSectionHeading title="Almacenes" title-id="settings-warehouses-title" description="Administra los lugares donde guardas tu mercancía." />
      <AppButton label="Nuevo almacén" icon="i-lucide-plus" @click="openWarehouse()" />
    </div>
    <UAlert v-if="loadError" title="No se pudieron cargar los almacenes." color="error">
      <template #actions>
        <AppButton label="Reintentar" intent="secondary" @click="refresh()" />
      </template>
    </UAlert>
    <ListLoading v-else-if="status === 'idle' || status === 'pending'" />
    <UEmpty
      v-else-if="!data?.results.length"
      title="Sin almacenes registrados"
      icon="i-lucide-warehouse"
      variant="naked"
    />
    <div v-else class="grid gap-3 md:grid-cols-2">
      <ListRecordCard
        v-for="warehouse in data.results"
        :key="warehouse.id"
        :title="warehouse.name"
        :eyebrow="warehouse.code"
        :fields="[{ label: 'Dirección', value: warehouse.address, fullWidth: true }]"
      >
        <template #trailing>
          <UBadge :color="warehouse.active ? 'success' : 'neutral'">
            {{ warehouse.active ? 'Activo' : 'Inactivo' }}
          </UBadge>
        </template>
        <template #summary>
          <AppButton
            label="Editar"
            :aria-label="`Editar almacén ${warehouse.name}`"
            intent="secondary"
            size="sm"
            class="self-end"
            @click="openWarehouse(warehouse)"
          />
        </template>
      </ListRecordCard>
    </div>
    <UModal v-model:open="open" :title="editing ? 'Editar almacén' : 'Nuevo almacén'">
      <template #body>
        <UAlert
          v-if="error"
          :title="error"
          color="error"
          class="mb-4"
        />
        <InventoryWarehouseForm
          :key="editing?.id ?? 'new'"
          :warehouse="editing"
          :busy="busy"
          @submit="save"
        />
      </template>
    </UModal>
  </section>
</template>
