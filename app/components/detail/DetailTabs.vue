<script setup lang="ts">
withDefaults(defineProps<{
  items: Array<{ label: string, value: string, icon?: string, description?: string }>
  content?: boolean
}>(), { content: true })
const model = defineModel<string>({ required: true })
</script>

<template>
  <UTabs
    v-model="model"
    :items="items"
    :content="content"
    variant="link"
    :ui="{ list: 'w-full flex-wrap gap-y-1', trigger: 'min-w-0 flex-1 justify-center', content: 'min-w-0' }"
  >
    <template #default="{ item }">
      <UTooltip v-if="item.description" :text="item.description" :content="{ side: 'top' }">
        <span class="whitespace-normal text-center">{{ item.label }}</span>
      </UTooltip>
      <span v-else class="whitespace-normal text-center">{{ item.label }}</span>
    </template>
    <template v-if="$slots.content" #content="scope">
      <slot name="content" v-bind="scope" />
    </template>
  </UTabs>
</template>
