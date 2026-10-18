<script setup lang="ts">
defineProps<{
  items: Array<{ label: string, value: string }>
  label: string
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
  <UTabs
    v-model="model"
    :items="items"
    :content="false"
    :aria-label="label"
    class="hidden w-full sm:block"
  />
</template>
