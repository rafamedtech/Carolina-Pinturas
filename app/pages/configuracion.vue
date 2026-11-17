<script setup lang="ts">
import { tableQueryField, tableQueryText } from '~/utils/tableQuery'

interface ConnectionStatus { configured: boolean }
const { data, status, refresh } = useFetch<ConnectionStatus>('/api/siigo/status', { server: false, lazy: true })
const tab = shallowRef('general')
const tabs = [
  { label: 'General', value: 'general', icon: 'i-lucide-settings' },
  { label: 'Inventario', value: 'inventory', icon: 'i-lucide-warehouse' }
]
useTableQuery([tableQueryField('tab', tab, tableQueryText('general', ['general', 'inventory']))])
useSeoMeta({ title: 'Configuración' })
</script>

<template>
  <ListPage
    id="configuration"
    title="Configuración"
    :show-refresh="false"
    views-before-toolbar
  >
    <template #views>
      <ListViews v-model="tab" :items="tabs" label="Sección de configuración" />
    </template>
    <SettingsInventory v-if="tab === 'inventory'" />
    <template v-else>
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
  </ListPage>
</template>
