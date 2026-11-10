<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { InventorySummary } from '#shared/types/inventory'
import { formatDate } from '~/utils/datetime'

defineProps<{ movements: InventorySummary['recentMovements'] }>()
const emit = defineEmits<{ view: [] }>()
type Movement = InventorySummary['recentMovements'][number]
const columns: TableColumn<Movement>[] = [
  { accessorKey: 'folio', header: 'Folio' },
  { accessorKey: 'date', header: 'Fecha' },
  { accessorKey: 'type', header: 'Movimiento' },
  { accessorKey: 'reason', header: 'Motivo' },
  { accessorKey: 'actorName', header: 'Registrado por' }
]
</script>

<template>
  <DetailCard class="min-w-0" :ui="{ container: 'min-w-0' }">
    <DetailSectionHeading title="Movimientos recientes" description="Los últimos cinco registros, del más reciente al más antiguo.">
      <template #actions>
        <AppButton
          label="Ver movimientos"
          intent="secondary"
          trailing-icon="i-lucide-arrow-up-right"
          @click="emit('view')"
        />
      </template>
    </DetailSectionHeading>
    <div class="space-y-3 md:hidden">
      <ListRecordCard
        v-for="movement in movements"
        :key="movement.id"
        :title="`INV-${movement.folio}`"
        :eyebrow="formatDate(movement.date)"
        :fields="[
          { label: 'Movimiento', value: movement.type.replaceAll('_', ' ') },
          { label: 'Registrado por', value: movement.actorName },
          { label: 'Motivo', value: movement.reason, fullWidth: true }
        ]"
      />
      <UEmpty
        v-if="!movements.length"
        title="Sin movimientos registrados"
        icon="i-lucide-arrow-left-right"
        variant="naked"
      />
    </div>
    <DetailTable
      :data="movements"
      :columns="columns"
      empty="Sin movimientos registrados"
      class="hidden md:block"
    >
      <template #folio-cell="{ row }">
        <span class="font-medium text-highlighted">INV-{{ row.original.folio }}</span>
      </template>
      <template #date-cell="{ row }">
        {{ formatDate(row.original.date) }}
      </template>
      <template #type-cell="{ row }">
        <UBadge color="neutral" variant="subtle">
          {{ row.original.type.replaceAll('_', ' ') }}
        </UBadge>
      </template>
      <template #reason-cell="{ row }">
        <span class="block max-w-sm whitespace-normal">{{ row.original.reason }}</span>
      </template>
    </DetailTable>
  </DetailCard>
</template>
