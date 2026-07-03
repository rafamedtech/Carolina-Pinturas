<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import AuthCard from '~/components/auth/AuthCard.vue'
import {
  updatePasswordSchema,
  type UpdatePasswordInput
} from '~/utils/authSchemas'

definePageMeta({ layout: false })
useSeoMeta({ title: 'Actualizar contraseña' })

const state = reactive<Partial<UpdatePasswordInput>>({
  password: '',
  confirmPassword: ''
})
const errorMessage = shallowRef('')
const loading = shallowRef(false)
const { updatePassword } = useAuth()

async function onSubmit(event: FormSubmitEvent<UpdatePasswordInput>) {
  loading.value = true
  errorMessage.value = ''

  try {
    await updatePassword(event.data.password)
    await navigateTo('/login?password_updated=1')
  } catch {
    errorMessage.value = 'No fue posible actualizar la contraseña. Solicita un enlace nuevo.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthCard title="Nueva contraseña" description="Define una contraseña segura">
    <UForm
      :schema="updatePasswordSchema"
      :state="state"
      class="space-y-5"
      @submit="onSubmit"
    >
      <UAlert
        v-if="errorMessage"
        color="error"
        variant="subtle"
        :description="errorMessage"
        icon="i-lucide-circle-alert"
      />

      <UFormField label="Nueva contraseña" name="password">
        <UInput
          v-model="state.password"
          type="password"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Confirmar contraseña" name="confirmPassword">
        <UInput
          v-model="state.confirmPassword"
          type="password"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>

      <UButton
        type="submit"
        label="Guardar contraseña"
        block
        :loading="loading"
      />
    </UForm>
  </AuthCard>
</template>
