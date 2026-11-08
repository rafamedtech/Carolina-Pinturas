<script setup lang="ts">
import type { ButtonProps, ButtonSlots } from '@nuxt/ui'

defineOptions({ inheritAttrs: false })
const props = defineProps<ButtonProps & { intent?: 'primary' | 'secondary' | 'danger' | 'quiet' }>()
const slots = defineSlots<ButtonSlots>()
function slotNames() {
  return Object.keys(slots) as Array<keyof ButtonSlots>
}
const buttonProps = computed(() => {
  const { intent = 'primary', ...rest } = props
  const defaults = {
    primary: { color: 'primary', variant: 'solid' },
    secondary: { color: 'neutral', variant: 'outline' },
    danger: { color: 'error', variant: 'soft' },
    quiet: { color: 'neutral', variant: 'ghost' }
  } as const
  return { ...rest, color: rest.color ?? defaults[intent].color, variant: rest.variant ?? defaults[intent].variant }
})
</script>

<template>
  <UButton v-bind="{ ...buttonProps, ...$attrs }">
    <template v-for="name in slotNames()" #[name]="scope">
      <slot :name="name" v-bind="scope" />
    </template>
  </UButton>
</template>
