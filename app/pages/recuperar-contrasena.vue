<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import AuthCard from '~/components/auth/AuthCard.vue'
import {
  passwordRecoverySchema,
  type PasswordRecoveryInput
} from '~/utils/authSchemas'

definePageMeta({ layout: false })
useSeoMeta({ title: 'Recuperar contraseña' })

const state = reactive<Partial<PasswordRecoveryInput>>({ email: '' })
const sent = shallowRef(false)
const loading = shallowRef(false)
const { requestPasswordRecovery } = useAuth()

async function onSubmit(event: FormSubmitEvent<PasswordRecoveryInput>) {
  loading.value = true

  try {
    await requestPasswordRecovery(event.data.email)
  } finally {
    sent.value = true
    loading.value = false
  }
}
</script>

<template>
  <AuthCard title="Recuperar contraseña" description="Te enviaremos un enlace de acceso">
    <div class="space-y-5">
      <UAlert
        v-if="sent"
        color="success"
        variant="subtle"
        title="Revisa tu correo"
        description="Si el correo pertenece a un usuario habilitado, recibirás instrucciones para cambiar la contraseña."
        icon="i-lucide-mail-check"
      />

      <UForm
        v-else
        :schema="passwordRecoverySchema"
        :state="state"
        class="space-y-5"
        @submit="onSubmit"
      >
        <UFormField label="Correo" name="email">
          <UInput
            v-model="state.email"
            type="email"
            autocomplete="email"
            class="w-full"
          />
        </UFormField>

        <UButton
          type="submit"
          label="Enviar enlace"
          block
          :loading="loading"
        />
      </UForm>

      <UButton
        to="/login"
        label="Volver a iniciar sesión"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        block
      />
    </div>
  </AuthCard>
</template>
