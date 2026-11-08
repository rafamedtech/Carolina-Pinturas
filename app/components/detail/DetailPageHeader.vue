<script setup lang="ts">
import type { PageHeaderProps, PageHeaderSlots } from '@nuxt/ui'

defineOptions({ inheritAttrs: false })
const props = defineProps<PageHeaderProps>()
const slots = defineSlots<PageHeaderSlots>()
function slotNames() {
  return Object.keys(slots) as Array<keyof PageHeaderSlots>
}
const headerUi = computed(() => ({
  root: 'pt-0 pb-5',
  title: 'min-w-0 flex-1 text-xl sm:text-2xl font-semibold',
  links: 'hidden sm:flex',
  ...props.ui
}))
</script>

<template>
  <UPageHeader v-bind="{ ...props, ...$attrs }" :ui="headerUi">
    <template v-for="name in slotNames()" #[name]="scope">
      <slot :name="name" v-bind="scope" />
    </template>
  </UPageHeader>
</template>
