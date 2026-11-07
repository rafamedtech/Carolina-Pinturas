<script setup lang="ts">
import type { TabsProps } from '@nuxt/ui'

defineProps<{
  items: Array<{ label: string, value: string }>
  label: string
  variant?: TabsProps['variant']
  fullWidth?: boolean
}>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <USelect
    v-model="model"
    :items="items"
    :aria-label="label"
    class="w-full sm:hidden"
  />
  <DetailTabs
    v-if="variant === 'link' && fullWidth"
    v-model="model"
    :items="items"
    :content="false"
    :aria-label="label"
    class="hidden w-full sm:block"
  />
  <UTabs
    v-else
    v-model="model"
    :variant="variant"
    :ui="fullWidth ? { list: 'w-full', trigger: 'flex-1 justify-center' } : undefined"
    :items="items"
    :content="false"
    :aria-label="label"
    class="hidden w-full sm:block"
  />
</template>
