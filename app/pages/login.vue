<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import AuthCard from '~/components/auth/AuthCard.vue'
import {
  loginSchema,
  type LoginInput
} from '~/utils/authSchemas'

definePageMeta({ layout: false })
useSeoMeta({ title: 'Iniciar sesión' })

const route = useRoute()
const state = reactive<Partial<LoginInput>>({ email: '', password: '' })
const errorMessage = shallowRef('')
const loading = shallowRef(false)
const { login } = useAuth()

const successMessage = computed(() =>
  route.query.password_updated === '1'
    ? 'Tu contraseña fue actualizada. Inicia sesión nuevamente.'
    : ''
)
const callbackError = computed(() =>
  route.query.auth_error
    ? 'El enlace de recuperación es inválido o expiró. Solicita uno nuevo.'
    : route.query.reason === 'disabled'
      ? 'Tu usuario no está habilitado para acceder al panel.'
      : ''
)

async function onSubmit(event: FormSubmitEvent<LoginInput>) {
  loading.value = true
  errorMessage.value = ''

  try {
    await login(event.data.email, event.data.password)
    await navigateTo('/')
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error
      ? error.message
      : 'No fue posible iniciar sesión.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthCard title="Carolina Pinturas" description="Panel interno">
    <UForm
      :schema="loginSchema"
      :state="state"
      class="space-y-5"
      @submit="onSubmit"
    >
      <UAlert
        v-if="successMessage"
        color="success"
        variant="subtle"
        :description="successMessage"
        icon="i-lucide-circle-check"
      />

      <UAlert
        v-if="errorMessage || callbackError"
        color="error"
        variant="subtle"
        :description="errorMessage || callbackError"
        icon="i-lucide-circle-alert"
      />

      <UFormField label="Correo" name="email">
        <UInput
          v-model="state.email"
          type="email"
          autocomplete="email"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Contraseña" name="password">
        <UInput
          v-model="state.password"
          type="password"
          autocomplete="current-password"
          class="w-full"
        />
      </UFormField>

      <div class="flex justify-end">
        <NuxtLink to="/recuperar-contrasena" class="text-sm text-primary hover:underline">
          Olvidé mi contraseña
        </NuxtLink>
      </div>

      <UButton
        type="submit"
        label="Ingresar"
        block
        :loading="loading"
      />
    </UForm>
  </AuthCard>
</template>
