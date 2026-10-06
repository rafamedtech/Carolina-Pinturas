<script setup lang="ts">
import type { InventoryWarehouse } from '#shared/types/inventory'
import type { InventoryCommand } from '#shared/schemas/inventory'

const props = defineProps<{ warehouse?: InventoryWarehouse, busy: boolean }>()
const emit = defineEmits<{ submit: [command: InventoryCommand['command']] }>()
const form = reactive({ code: props.warehouse?.code ?? '', name: props.warehouse?.name ?? '', address: props.warehouse?.address ?? '', active: props.warehouse?.active ?? true })
</script>

<template>
  <form class="space-y-4" @submit.prevent="emit('submit', { action: 'warehouse', id: warehouse?.id, version: warehouse?.version, ...form })">
    <UFormField label="Código" required>
      <UInput
        v-model="form.code"
        maxlength="64"
        required
        class="w-full"
      />
    </UFormField>
    <UFormField label="Nombre" required>
      <UInput
        v-model="form.name"
        maxlength="200"
        required
        class="w-full"
      />
    </UFormField>
    <UFormField label="Dirección">
      <UTextarea v-model="form.address" maxlength="1000" class="w-full" />
    </UFormField>
    <USwitch v-model="form.active" label="Almacén activo" />
    <UButton type="submit" label="Guardar almacén" :loading="busy" />
  </form>
</template>
