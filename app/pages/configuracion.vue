<script setup lang="ts">
interface ConnectionStatus { configured: boolean }
const { data, status, refresh } = useFetch<ConnectionStatus>('/api/siigo/status', { server: false, lazy: true })
useSeoMeta({ title: 'Configuración' })
</script>

<template>
  <UDashboardPanel id="configuration">
    <template #header>
      <DetailHeader title="Configuración" :show-refresh="false" />
    </template>
    <template #body>
      <SettingsUserPermissions />
      <DetailCard title="Conexión con Siigo" description="Las credenciales se conservan exclusivamente en las variables de entorno del servidor." icon="i-lucide-plug-zap">
        <div class="flex items-center justify-between gap-4">
          <UBadge :color="data?.configured ? 'success' : 'warning'" variant="subtle" size="lg">
            {{ data?.configured ? 'Configurada' : 'Pendiente' }}
          </UBadge>
          <AppButton
            label="Comprobar"
            intent="secondary"
            :loading="status === 'pending'"
            @click="() => refresh()"
          />
        </div>
      </DetailCard>
    </template>
  </UDashboardPanel>
</template>
