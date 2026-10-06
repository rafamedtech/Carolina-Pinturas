<script setup lang="ts">
import type { ProductInput, ProductContext } from '~/types/siigo-products'

const props = defineProps<{ context: ProductContext }>()
const model = defineModel<ProductInput>({ required: true })
const selectedGroup = computed({
  get: () => model.value.account_group || undefined,
  set: (value: number | undefined) => {
    model.value.account_group = value ?? 0
  }
})
const groups = computed(() => {
  const options = props.context.accountGroups.filter(item => item.active || item.id === model.value.account_group).map(item => ({ label: item.name, value: item.id }))
  if (model.value.account_group && !options.some(item => item.value === model.value.account_group)) options.push({ label: `Clasificación actual ${model.value.account_group}`, value: model.value.account_group })
  return options
})
const types = [{ label: 'Producto', value: 'Product' }, { label: 'Servicio', value: 'Service' }, { label: 'Bien de consumo', value: 'ConsumerGood' }]
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">
        Información general
      </h2>
    </template>
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField label="Código" name="code" required>
        <UInput v-model="model.code" maxlength="30" class="w-full" />
      </UFormField>
      <UFormField label="Nombre" name="name" required>
        <UInput v-model="model.name" maxlength="100" class="w-full" />
      </UFormField>
      <UFormField label="Clasificación de inventario" name="account_group" required>
        <USelect
          v-model="selectedGroup"
          :items="groups"
          placeholder="Seleccionar clasificación"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Tipo" name="type" required>
        <USelect v-model="model.type" :items="types" class="w-full" />
      </UFormField>
      <UFormField label="Unidad SAT" name="unit" required>
        <ProductsSatPicker v-model="model.unit" kind="unit" label="Unidad SAT" />
      </UFormField>
      <UFormField label="Clave SAT" name="key" required>
        <ProductsSatPicker v-model="model.key" kind="key" label="Clave SAT" />
      </UFormField>
      <UFormField label="Referencia" name="reference">
        <UInput v-model="model.reference" maxlength="80" class="w-full" />
      </UFormField>
      <UFormField label="Marca" name="additional_fields.brand">
        <UInput v-model="model.additional_fields.brand" maxlength="50" class="w-full" />
      </UFormField>
      <UFormField label="Código de barras" name="additional_fields.barcode">
        <UInput v-model="model.additional_fields.barcode" maxlength="50" class="w-full" />
      </UFormField>
      <div class="flex flex-wrap items-center gap-4">
        <USwitch v-model="model.active" label="Activo" />
        <USwitch v-model="model.stock_control" label="Control de inventario en Siigo" />
      </div>
      <UFormField label="Descripción" name="description" class="sm:col-span-2">
        <UTextarea v-model="model.description" maxlength="2500" class="w-full" />
      </UFormField>
    </div>
  </UCard>
</template>
