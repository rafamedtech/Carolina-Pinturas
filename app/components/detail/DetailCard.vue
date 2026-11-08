<script setup lang="ts">
import type { PageCardProps, PageCardSlots } from '@nuxt/ui'

defineOptions({ inheritAttrs: false })
const props = defineProps<PageCardProps>()
const slots = defineSlots<PageCardSlots>()
function slotNames() {
  return Object.keys(slots).filter(name => name !== 'leading') as Array<Exclude<keyof PageCardSlots, 'leading'>>
}
</script>

<template>
  <UPageCard v-bind="{ ...props, ...$attrs }" :variant="props.variant ?? 'subtle'">
    <template v-if="$slots.leading" #leading="scope">
      <slot name="leading" v-bind="scope" />
    </template>
    <template v-for="name in slotNames()" #[name]="scope">
      <slot :name="name" v-bind="scope" />
    </template>
  </UPageCard>
</template>
