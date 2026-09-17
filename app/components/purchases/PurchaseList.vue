<script setup lang="ts">
import type { PurchaseView } from '~/types/purchases'

const search = shallowRef('')
const status = shallowRef('all')
const dateFrom = shallowRef('')
const dateTo = shallowRef('')
const query = computed(() => ({ search: search.value || undefined, status: status.value === 'all' ? undefined : status.value, dateFrom: dateFrom.value || undefined, dateTo: dateTo.value || undefined }))
const { data, error, status: loading, refresh } = await useFetch<{ results: PurchaseView[] }>('/api/purchases', { query })
</script>

<template>
  <UDashboardPanel id="purchases">
    <template #header>
      <UDashboardNavbar title="Compras">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template><template #right>
          <UButton to="/compras/cuentas-por-pagar" label="Cuentas por pagar" variant="outline" /><UButton to="/compras/nueva" label="Nueva compra" icon="i-lucide-plus" />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="grid gap-3 md:grid-cols-4">
        <UFormField label="Proveedor">
          <UInput v-model="search" placeholder="Buscar proveedor" class="w-full" />
        </UFormField><UFormField label="Estado">
          <USelect v-model="status" :items="[{ label: 'Todos', value: 'all' }, { label: 'Borrador', value: 'borrador' }, { label: 'Confirmada', value: 'confirmada' }, { label: 'Cancelada', value: 'cancelada' }]" class="w-full" />
        </UFormField><UFormField label="Desde">
          <PurchasesPurchaseDate v-model="dateFrom" />
        </UFormField><UFormField label="Hasta">
          <PurchasesPurchaseDate v-model="dateTo" />
        </UFormField>
      </div>
      <div class="flex gap-2">
        <UButton label="Limpiar filtros" variant="ghost" @click="search = ''; status = 'all'; dateFrom = ''; dateTo = ''" /><UButton label="Recargar" variant="ghost" @click="refresh()" />
      </div>
      <UAlert v-if="error" title="No se pudieron cargar las compras." color="error" />
      <p v-else-if="loading === 'pending'">
        Cargando compras…
      </p>
      <p v-else-if="!data?.results.length" class="py-10 text-center text-muted">
        Sin compras para estos filtros.
      </p>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-default">
              <th class="p-3">
                Orden
              </th><th class="p-3">
                Proveedor
              </th><th class="p-3">
                Fecha
              </th><th class="p-3">
                Estado
              </th><th class="p-3">
                Recepción
              </th><th class="p-3">
                Total
              </th><th class="p-3">
                Saldo facturado
              </th>
            </tr>
          </thead><tbody>
            <tr v-for="order in data.results" :key="order.id" class="border-b border-default">
              <td class="p-3">
                <NuxtLink :to="`/compras/${order.id}`" class="font-semibold text-primary underline">OC-{{ order.folio }}</NuxtLink>
              </td><td class="p-3">
                {{ order.providerName }}
              </td><td class="p-3">
                {{ order.date }}
              </td><td class="p-3">
                {{ order.status }}
              </td><td class="p-3">
                {{ order.receiptStatus }}
              </td><td class="p-3">
                {{ order.total.toFixed(2) }} {{ order.currencyCode }}
              </td><td class="p-3">
                {{ order.balance.toFixed(2) }} {{ order.currencyCode }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </UDashboardPanel>
</template>
