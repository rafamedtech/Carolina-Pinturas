<script setup lang="ts">
useSeoMeta({ title: 'Clientes' })
</script>

<template>
  <CustomersCustomerCatalog
    title="Clientes"
    singular-label="Cliente"
    route-base="/clientes"
    customer-type="Customer"
  />
</template>
