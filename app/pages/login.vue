<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: false })

const schema = z.object({
  email: z.string().email('Escribe un correo válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.')
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({ email: '', password: '' })
const errorMessage = ref('')
const loading = ref(false)
const { login } = useAuth()

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  errorMessage.value = ''

  try {
    await login(event.data.email, event.data.password)
    await navigateTo('/')
  } catch (error: unknown) {
    const apiError = error as { data?: { statusMessage?: string } }
    errorMessage.value = apiError.data?.statusMessage || 'No fue posible iniciar sesión.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="min-h-screen bg-default flex items-center justify-center p-6">
    <UCard class="w-full max-w-md" :ui="{ header: 'p-6 sm:px-7', body: 'p-6 sm:px-7' }">
      <template #header>
        <div class="flex items-center gap-3">
          <div class="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <UIcon name="i-lucide-paint-roller" class="size-5" />
          </div>
          <div>
            <h1 class="font-semibold text-highlighted">
              Carolina Pinturas
            </h1>
            <p class="text-sm text-muted">
              Panel interno
            </p>
          </div>
        </div>
      </template>

      <UForm
        :schema="schema"
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

        <UButton
          type="submit"
          label="Ingresar"
          block
          :loading="loading"
        />
      </UForm>
    </UCard>
  </main>
</template>
