<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'

const props = withDefaults(defineProps<{
  title: string
  eyebrow?: string
  to?: ButtonProps['to']
  titleTo?: ButtonProps['to']
  actionable?: boolean
  ariaLabel?: string
  fields?: ReadonlyArray<{ key?: string, label: string, value?: string | number | null, fullWidth?: boolean }>
  summaryLabel?: string
  summaryValue?: string | number | null
  summaryColor?: 'neutral' | 'primary'
}>(), { summaryColor: 'neutral' })

defineSlots<{
  'field-value'(scope: { field: NonNullable<typeof props.fields>[number] }): unknown
  'summary-leading'(): unknown
  'trailing'(): unknown
  'actions'(): unknown
  'default'(): unknown
  'summary'(): unknown
}>()
const emit = defineEmits<{ select: [] }>()
const interactive = computed(() => Boolean(props.to) || props.actionable)
</script>

<template>
  <DetailCard
    as="article"
    class="min-w-0 w-full text-left"
    :class="{ 'transition-[transform,background-color,box-shadow] duration-150 ease-out hover:bg-elevated/50 active:scale-[0.985] active:bg-elevated motion-reduce:transform-none motion-reduce:transition-none': interactive }"
    :ui="{ container: 'flex flex-col gap-4 p-4 sm:p-4 lg:flex' }"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p v-if="eyebrow" class="text-xs font-medium text-muted">
          {{ eyebrow }}
        </p>
        <h3 class="text-lg font-semibold break-words text-primary">
          <ULink
            v-if="titleTo"
            :to="titleTo"
            :aria-label="ariaLabel || `Abrir ${title}`"
            class="text-primary hover:underline"
          >
            {{ title }}
          </ULink>
          <template v-else>
            {{ title }}
          </template>
        </h3>
      </div>
      <div v-if="$slots.trailing || $slots.actions" class="flex shrink-0 items-start gap-2">
        <slot name="trailing" />
        <div v-if="$slots.actions" class="relative z-10">
          <slot name="actions" />
        </div>
      </div>
    </div>

    <slot>
      <DetailFields v-if="fields?.length" :fields="fields" class="text-sm">
        <template v-if="$slots['field-value']" #value="scope">
          <slot name="field-value" v-bind="scope" />
        </template>
      </DetailFields>
    </slot>

    <dl v-if="summaryLabel" class="border-t border-default pt-3 text-sm" :class="{ 'grid grid-cols-2 gap-4': $slots['summary-leading'] }">
      <slot name="summary-leading" />
      <div :class="$slots['summary-leading'] ? 'min-w-0 text-right' : 'flex items-end justify-between gap-4'">
        <dt class="text-muted">
          {{ summaryLabel }}
        </dt>
        <dd class="min-w-0 text-base font-semibold break-words" :class="summaryColor === 'primary' ? 'text-primary' : 'text-highlighted'">
          <slot name="summary">
            {{ summaryValue ?? '—' }}
          </slot>
        </dd>
      </div>
    </dl>
    <slot v-else name="summary" />

    <AppButton
      v-if="interactive"
      :to="to"
      :aria-label="ariaLabel || `Abrir ${title}`"
      intent="quiet"
      variant="link"
      class="absolute inset-0 size-full cursor-pointer rounded-lg p-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      @click="!to && emit('select')"
    />
  </DetailCard>
</template>
