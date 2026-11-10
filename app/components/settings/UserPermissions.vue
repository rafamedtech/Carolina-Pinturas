<script setup lang="ts">
import { USER_ROLE_OPTIONS } from '~/utils/roleAccess'
import type { UserRole } from '~/types/siigo'

interface UserProfile { userId: string, name: string, email: string, role: UserRole, active: boolean }
const { data, status, error, refresh } = useFetch<UserProfile[]>('/api/users', { server: false, lazy: true, default: () => [] })
const drafts = ref<Record<string, { role: Exclude<UserRole, 'admin'>, active: boolean }>>({})
const saving = shallowRef<string>()
const message = shallowRef('')
const toast = useToast()
watch(data, (users) => {
  drafts.value = Object.fromEntries(users.filter(user => user.role !== 'admin').map(user => [user.userId, { role: user.role as Exclude<UserRole, 'admin'>, active: user.active }]))
}, { immediate: true })
function changed(user: UserProfile) {
  const draft = drafts.value[user.userId]
  return draft && (draft.role !== user.role || draft.active !== user.active)
}
async function save(user: UserProfile) {
  if (saving.value || user.role === 'admin') return
  saving.value = user.userId
  message.value = ''
  try {
    await $fetch(`/api/users/${user.userId}`, { method: 'PATCH', body: drafts.value[user.userId] })
    await refresh()
    toast.add({ title: 'Permisos actualizados', description: user.email, color: 'success' })
  } catch (error: unknown) {
    message.value = (error as { data?: { statusMessage?: string } }).data?.statusMessage || 'No fue posible guardar los permisos.'
  } finally { saving.value = undefined }
}
</script>

<template>
  <DetailCard title="Usuarios y permisos" icon="i-lucide-shield-check" description="Administra el perfil y el acceso de los usuarios registrados. Los cambios se aplican a sus siguientes peticiones.">
    <UAlert v-if="error || message" color="error" :title="message || 'No fue posible cargar los usuarios.'">
      <template v-if="error" #actions>
        <AppButton label="Reintentar" intent="secondary" @click="refresh()" />
      </template>
    </UAlert>
    <div
      v-if="status === 'idle' || status === 'pending'"
      role="status"
      aria-label="Cargando usuarios"
      class="space-y-3"
    >
      <USkeleton v-for="index in 3" :key="index" class="h-24 w-full" />
    </div>
    <UEmpty v-else-if="!data.length && !error" title="No hay usuarios registrados" />
    <div v-else class="space-y-4">
      <DetailCard
        v-for="profile in data"
        :key="profile.userId"
        :title="profile.name"
        :description="profile.email"
        :ui="{ description: 'break-all' }"
      >
        <template v-if="profile.role === 'admin'">
          <UBadge label="Administrador · Todos los permisos" color="primary" variant="subtle" />
          <p class="text-sm text-muted">
            Acceso completo y permanente. Este perfil no se puede modificar.
          </p>
        </template>
        <div v-else-if="drafts[profile.userId]" class="flex flex-col gap-4">
          <UFormField label="Perfil">
            <USelect
              v-model="drafts[profile.userId]!.role"
              :aria-label="`Perfil de ${profile.email}`"
              :items="USER_ROLE_OPTIONS.map(({ value, label }) => ({ value, label }))"
              :disabled="Boolean(saving)"
              class="w-full sm:w-64"
            />
          </UFormField>
          <p class="text-sm text-muted">
            {{ USER_ROLE_OPTIONS.find(option => option.value === drafts[profile.userId]?.role)?.description }}
          </p>
          <div class="flex flex-wrap items-center justify-between gap-4">
            <USwitch
              v-model="drafts[profile.userId]!.active"
              label="Acceso habilitado"
              :aria-label="`Acceso habilitado para ${profile.email}`"
              :disabled="Boolean(saving)"
            />
            <AppButton
              label="Guardar permisos"
              icon="i-lucide-save"
              :aria-label="`Guardar permisos de ${profile.email}`"
              :loading="saving === profile.userId"
              :disabled="!changed(profile) || Boolean(saving)"
              @click="save(profile)"
            />
          </div>
        </div>
      </DetailCard>
    </div>
  </DetailCard>
</template>
