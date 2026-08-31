<script setup lang="ts">
const props = defineProps<{
  customer: boolean
  supplier: boolean
  editable: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  save: [roles: { customer: boolean, supplier: boolean }]
}>()

const customerRole = shallowRef(props.customer)
const supplierRole = shallowRef(props.supplier)

watch(() => [props.customer, props.supplier] as const, ([customer, supplier]) => {
  customerRole.value = customer
  supplierRole.value = supplier
})

const valid = computed(() => customerRole.value || supplierRole.value)
const changed = computed(() =>
  customerRole.value !== props.customer || supplierRole.value !== props.supplier
)

function save() {
  if (!valid.value || !changed.value) return
  emit('save', { customer: customerRole.value, supplier: supplierRole.value })
}
</script>

<template>
  <UCard>
    <template #header>
      <div>
        <h2 class="font-semibold text-highlighted">
          Roles en la aplicación
        </h2>
        <p class="mt-1 text-sm text-muted">
          Siigo API no distingue cuando un tercero tiene ambos roles.
        </p>
      </div>
    </template>

    <div class="flex flex-col gap-4">
      <USwitch
        v-model="customerRole"
        label="Cliente"
        description="Aparece en el catálogo de Clientes."
        :disabled="!editable || saving"
      />
      <USwitch
        v-model="supplierRole"
        label="Proveedor"
        description="Aparece en Proveedores y puede asociarse a gastos."
        :disabled="!editable || saving"
      />
      <p v-if="!valid" class="text-sm text-error">
        Selecciona al menos un rol.
      </p>
      <UButton
        v-if="editable"
        label="Guardar roles"
        icon="i-lucide-save"
        :loading="saving"
        :disabled="!valid || !changed || saving"
        class="self-start"
        @click="save"
      />
    </div>
  </UCard>
</template>
