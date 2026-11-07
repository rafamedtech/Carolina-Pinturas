<script setup lang="ts">
import type { TabsProps } from '@nuxt/ui'

const props = defineProps<{
  items: Array<{ label: string, value: string, icon?: string }>
  label: string
  variant?: TabsProps['variant']
  fullWidth?: boolean
}>()

const model = defineModel<string>({ required: true })
const selectedIcon = computed(() => props.items.find(item => item.value === model.value)?.icon)
</script>

<template>
  <USelect
    v-model="model"
    :icon="selectedIcon"
    :items="items"
    :ui="variant === 'link' && fullWidth ? { base: 'py-2', value: 'text-lg font-semibold text-highlighted' } : undefined"
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
