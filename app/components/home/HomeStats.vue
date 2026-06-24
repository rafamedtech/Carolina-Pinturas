<script setup lang="ts">
interface Summary {
  products: number
  customers: number
  invoices: number
  vouchers: number
}

const { data, status, error, refresh } = await useFetch<Summary>('/api/siigo/summary', {
  lazy: true
})

const stats = computed(() => [{
  title: 'Productos',
  icon: 'i-lucide-package',
  value: data.value?.products
}, {
  title: 'Clientes',
  icon: 'i-lucide-users',
  value: data.value?.customers
}, {
  title: 'Facturas',
  icon: 'i-lucide-receipt-text',
  value: data.value?.invoices
}, {
  title: 'Cobros',
  icon: 'i-lucide-receipt',
  value: data.value?.vouchers
}])

const message = computed(() => error.value?.data?.statusMessage || 'No fue posible cargar el resumen de Siigo.')
</script>

<template>
  <div class="space-y-4">
    <UAlert
      v-if="error"
      color="warning"
      variant="subtle"
      title="Siigo aún no está conectado"
      :description="message"
      icon="i-lucide-plug-zap"
    >
      <template #actions>
        <UButton
          label="Reintentar"
          color="warning"
          variant="soft"
          size="xs"
          @click="() => refresh()"
        />
      </template>
    </UAlert>

    <UPageGrid class="lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-px">
      <UPageCard
        v-for="stat in stats"
        :key="stat.title"
        :icon="stat.icon"
        :title="stat.title"
        variant="subtle"
        :ui="{
          container: 'gap-y-1.5',
          wrapper: 'items-start',
          leading: 'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col',
          title: 'font-normal text-muted text-xs uppercase'
        }"
        class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg"
      >
        <span class="text-2xl font-semibold text-highlighted">
          {{ status === 'pending' ? '—' : (stat.value ?? '—') }}
        </span>
      </UPageCard>
    </UPageGrid>
  </div>
</template>
