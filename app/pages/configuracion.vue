<script setup lang="ts">
interface ConnectionStatus {
  configured: boolean
}

const { data, status, refresh } = await useFetch<ConnectionStatus>('/api/siigo/status', { lazy: true })

useSeoMeta({ title: 'Configuración' })
</script>

<template>
  <UDashboardPanel id="configuration">
    <template #header>
      <UDashboardNavbar title="Configuración">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UPageCard
        title="Conexión con Siigo"
        description="Las credenciales se conservan exclusivamente en las variables de entorno del servidor."
        icon="i-lucide-plug-zap"
      >
        <div class="flex items-center justify-between gap-4">
          <UBadge :color="data?.configured ? 'success' : 'warning'" variant="subtle" size="lg">
            {{ data?.configured ? 'Configurada' : 'Pendiente' }}
          </UBadge>
          <UButton
            label="Comprobar"
            color="neutral"
            variant="outline"
            :loading="status === 'pending'"
            @click="() => refresh()"
          />
        </div>
      </UPageCard>

      <UAlert
        color="neutral"
        variant="subtle"
        title="Siguiente configuración"
        description="Agrega NUXT_APP_SESSION_SECRET, NUXT_APP_USERS y las cuatro variables NUXT_SIIGO_* en Vercel. No ingreses secretos en esta pantalla."
        icon="i-lucide-lock-keyhole"
      />
    </template>
  </UDashboardPanel>
</template>
