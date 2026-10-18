<script setup lang="ts">
import type { ListCreateAction } from '~/types/list'

defineProps<{ action: ListCreateAction }>()
const emit = defineEmits<{ create: [] }>()
</script>

<template>
  <UDropdownMenu
    v-if="action.items?.length"
    :items="action.items"
    :content="{ align: 'end', collisionPadding: 12 }"
    :ui="{ content: 'w-64' }"
  >
    <UButton
      :label="action.label || 'Nuevo'"
      :icon="action.icon || 'i-lucide-plus'"
      trailing-icon="i-lucide-chevron-down"
      :disabled="action.disabled"
      :title="action.reason"
      class="w-full justify-center data-[state=open]:bg-primary/90 sm:w-auto"
    />
  </UDropdownMenu>
  <UButton
    v-else
    :label="action.label || 'Nuevo'"
    :icon="action.icon || 'i-lucide-plus'"
    :to="action.to"
    :disabled="action.disabled"
    :title="action.reason"
    class="w-full justify-center sm:w-auto"
    @click="emit('create')"
  />
</template>
