<script setup lang="ts">
import type { ProductImage } from '~/types/siigo-products'

const props = defineProps<{ productId: string, productName?: string }>()
const image = defineModel<ProductImage | null>('image', { default: null })

const MAX_BYTES = 2 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp'

const toast = useToast()
const file = ref<File | null>(null)
const uploading = shallowRef(false)
const removing = shallowRef(false)
const busy = computed(() => uploading.value || removing.value)
const endpoint = computed(() => `/api/siigo/products/${encodeURIComponent(props.productId)}/image`)

function errorMessage(error: unknown) {
  const response = error as { data?: { statusMessage?: string }, message?: string }
  return response.data?.statusMessage || response.message || 'Intenta nuevamente.'
}

watch(file, async (selected) => {
  if (!selected || uploading.value) return
  try {
    if (!ACCEPT.split(',').includes(selected.type)) throw new Error('Solo se permiten imágenes JPG, PNG o WebP.')
    if (selected.size > MAX_BYTES) throw new Error('La imagen no puede pesar más de 2 MB.')
    uploading.value = true
    const body = new FormData()
    body.append('image', selected)
    image.value = await $fetch<ProductImage>(endpoint.value, { method: 'PUT', body })
    toast.add({ title: 'Imagen actualizada', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (error) {
    toast.add({ title: 'No se pudo guardar la imagen', description: errorMessage(error), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    uploading.value = false
    file.value = null
  }
})

async function removeImage() {
  if (busy.value) return
  removing.value = true
  try {
    await $fetch(endpoint.value, { method: 'DELETE' })
    image.value = null
    toast.add({ title: 'Imagen eliminada', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (error) {
    toast.add({ title: 'No se pudo eliminar la imagen', description: errorMessage(error), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold text-highlighted">
          Imagen
        </h2>
        <UButton
          v-if="image"
          label="Quitar imagen"
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          :loading="removing"
          :disabled="uploading"
          @click="removeImage"
        />
      </div>
    </template>
    <div class="grid gap-4 sm:grid-cols-2">
      <div class="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-default bg-elevated">
        <img
          v-if="image"
          :src="image.url"
          :alt="productName || 'Imagen del producto'"
          width="480"
          height="480"
          loading="lazy"
          decoding="async"
          class="size-full object-contain"
        >
        <div v-else class="flex flex-col items-center gap-2 text-muted">
          <UIcon name="i-lucide-image-off" class="size-8" />
          <span class="text-sm">Sin imagen</span>
        </div>
      </div>
      <UFileUpload
        v-model="file"
        :accept="ACCEPT"
        :label="image ? 'Reemplazar imagen' : 'Subir imagen'"
        description="JPG, PNG o WebP. Máximo 2 MB."
        icon="i-lucide-image-up"
        :preview="false"
        :disabled="busy"
        class="min-h-48"
      />
    </div>
    <p v-if="uploading" class="mt-3 text-sm text-muted" role="status">
      Subiendo imagen…
    </p>
  </UCard>
</template>
