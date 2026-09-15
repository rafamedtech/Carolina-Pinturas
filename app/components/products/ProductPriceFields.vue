<script setup lang="ts">
import type { ProductInput, ProductContext } from '~/types/siigo-products'

const props = defineProps<{ context: ProductContext }>()
const model = defineModel<ProductInput>({ required: true })
const selectedTaxes = computed({ get: () => model.value.taxes.map(item => item.id), set: (ids: number[]) => {
  model.value.taxes = ids.map(id => ({ id }))
} })
const taxes = computed(() => {
  const options = props.context.taxes.filter(item => item.active || selectedTaxes.value.includes(item.id)).map(item => ({ label: item.name, value: item.id }))
  for (const id of selectedTaxes.value) if (!options.some(item => item.value === id)) options.push({ label: `Impuesto actual ${id}`, value: id })
  return options
})
const lists = computed(() => {
  const positions = model.value.prices.flatMap(group => group.price_list.map(item => item.position))
  const options = props.context.priceLists.filter(item => item.active || positions.includes(item.id)).map(item => ({ label: item.name, value: item.id }))
  for (const position of positions) if (!options.some(item => item.value === position)) options.push({ label: `Lista actual ${position}`, value: position })
  return options
})
function addPrice(index: number) {
  const group = model.value.prices[index]
  if (!group) return
  const option = props.context.priceLists.find(item => item.active && !group.price_list.some(price => price.position === item.id))
  if (option) group.price_list.push({ position: option.id, value: 0 })
}
function addCurrency() {
  const currency = model.value.prices.some(item => item.currency_code === 'MXN') ? '' : 'MXN'
  model.value.prices.push({ currency_code: currency, price_list: [] })
  addPrice(model.value.prices.length - 1)
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">
        Precios e impuestos
      </h2>
    </template>
    <div class="space-y-5">
      <div class="grid items-center gap-4 sm:grid-cols-2">
        <UFormField label="Impuestos" name="taxes">
          <USelect
            v-model="selectedTaxes"
            :items="taxes"
            multiple
            placeholder="Seleccionar impuestos"
            class="w-full"
          />
        </UFormField>
        <USwitch v-model="model.tax_included" label="IVA incluido en precio" />
      </div>
      <UFormField name="prices">
        <div class="space-y-4">
          <div v-for="(group, index) in model.prices" :key="index" class="space-y-3 rounded-lg border border-default p-4">
            <div class="flex items-end justify-between gap-3">
              <UFormField label="Moneda" :name="`prices.${index}.currency_code`">
                <UInput
                  v-model="group.currency_code"
                  placeholder="MXN"
                  maxlength="3"
                  class="w-28"
                />
              </UFormField>
              <UButton
                label="Quitar moneda"
                variant="ghost"
                color="error"
                @click="model.prices.splice(index, 1)"
              />
            </div>
            <div v-for="(price, row) in group.price_list" :key="row" class="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
              <UFormField label="Lista de precios" :name="`prices.${index}.price_list.${row}.position`">
                <USelect v-model="price.position" :items="lists" class="w-full" />
              </UFormField>
              <UFormField label="Precio" :name="`prices.${index}.price_list.${row}.value`">
                <UInput
                  v-model.number="price.value"
                  type="number"
                  min="0.01"
                  step="0.01"
                  class="w-full"
                />
              </UFormField>
              <UButton
                icon="i-lucide-trash-2"
                aria-label="Quitar precio"
                color="error"
                variant="ghost"
                @click="group.price_list.splice(row, 1)"
              />
            </div>
            <UButton
              label="Agregar precio"
              icon="i-lucide-plus"
              variant="outline"
              :disabled="group.price_list.length >= 12 || !context.priceLists.some(item => item.active && !group.price_list.some(price => price.position === item.id))"
              @click="addPrice(index)"
            />
          </div>
          <UButton
            label="Agregar moneda y precios"
            icon="i-lucide-plus"
            variant="outline"
            :disabled="model.prices.length >= 12 || !context.priceLists.some(item => item.active)"
            @click="addCurrency"
          />
        </div>
      </UFormField>
    </div>
  </UCard>
</template>
