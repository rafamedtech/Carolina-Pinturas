<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Repartidor } from '~/types/orders'

const schema = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre.').max(150),
  telefono: z.string().trim().max(30)
})

type Schema = z.output<typeof schema>

const emit = defineEmits<{
  created: [repartidor: Repartidor]
}>()

const open = ref(false)
const saving = shallowRef(false)
const toast = useToast()
const state = reactive<Schema>({
  nombre: '',
  telefono: ''
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
  saving.value = true

  try {
    const repartidor = await $fetch<Repartidor>('/api/repartidores', {
      method: 'POST',
      body: {
        nombre: event.data.nombre,
        telefono: event.data.telefono || null
      }
    })

    emit('created', repartidor)
    toast.add({
      title: 'Repartidor creado',
      description: `${repartidor.nombre} ya está disponible para asignar.`,
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
    state.nombre = ''
    state.telefono = ''
    open.value = false
  } catch (error: unknown) {
    const fetchError = error as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'No se pudo crear el repartidor',
      description: fetchError.data?.statusMessage || fetchError.message || 'Intenta de nuevo.',
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Nuevo repartidor" description="Agrega un repartidor al catálogo">
    <UButton
      label="Nuevo repartidor"
      icon="i-lucide-plus"
      color="neutral"
      variant="outline"
      size="sm"
    />

    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Nombre" name="nombre" required>
          <UInput v-model="state.nombre" :disabled="saving" class="w-full" />
        </UFormField>
        <UFormField label="Teléfono" name="telefono">
          <UInput v-model="state.telefono" :disabled="saving" maxlength="30" class="w-full" />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            :disabled="saving"
            @click="open = false"
          />
          <UButton
            label="Crear"
            color="primary"
            variant="solid"
            type="submit"
            :loading="saving"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
