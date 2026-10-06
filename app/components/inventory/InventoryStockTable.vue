<script setup lang="ts">
import type { InventoryStock } from '#shared/types/inventory'

defineProps<{ rows: InventoryStock[], admin?: boolean }>()
const emit = defineEmits<{ minimum: [row: InventoryStock], kardex: [row: InventoryStock] }>()
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-default">
    <table class="w-full text-sm">
      <thead class="border-b border-default bg-elevated/50 text-left text-muted">
        <tr>
          <th class="p-3">
            Producto
          </th><th class="p-3">
            Almacén
          </th><th class="p-3 text-right">
            Existencia física
          </th><th class="p-3 text-right">
            Reservado
          </th><th class="p-3 text-right">
            Disponible
          </th><th class="p-3 text-right">
            Mínimo
          </th><th class="p-3">
            <span class="sr-only">Acciones</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-default">
        <tr v-for="row in rows" :key="`${row.warehouseId}-${row.productId}`">
          <td class="p-3">
            <p class="font-medium text-highlighted">
              {{ row.name }}
            </p><p class="text-muted">
              {{ row.code }} · {{ row.unit || 'Unidad' }}
            </p>
          </td>
          <td class="p-3">
            {{ row.warehouse }}
          </td><td class="p-3 text-right font-mono tabular-nums">
            {{ row.quantity }}
          </td><td class="p-3 text-right font-mono tabular-nums">
            {{ row.reserved }}
          </td>
          <td class="p-3 text-right font-mono font-semibold tabular-nums" :class="row.low ? 'text-warning' : 'text-primary'">
            {{ row.available }}<span v-if="row.low" class="block font-sans text-xs">Bajo mínimo</span>
          </td>
          <td class="p-3 text-right font-mono">
            {{ row.minimum }}
          </td>
          <td class="p-3">
            <div class="flex justify-end gap-1">
              <UButton
                label="Kardex"
                size="sm"
                variant="ghost"
                color="neutral"
                @click="emit('kardex', row)"
              /><UButton
                v-if="admin"
                label="Mínimo"
                size="sm"
                variant="ghost"
                @click="emit('minimum', row)"
              />
            </div>
          </td>
        </tr>
        <tr v-if="!rows.length">
          <td colspan="7" class="p-8 text-center text-muted">
            Sin existencias para estos filtros. Crea un almacén y registra el conteo inicial.
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
