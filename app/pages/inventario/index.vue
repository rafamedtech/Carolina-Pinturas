<script setup lang="ts">
const route = useRoute()
const { user } = useAuth()

if (route.query.tab === 'warehouses' && user.value?.role === 'admin') {
  await navigateTo({
    path: '/configuracion',
    query: {
      tab: 'inventory',
      search: route.query.search,
      tracking: route.query.tracking,
      productId: route.query.productId,
      page: route.query.page
    }
  }, { replace: true })
}
</script>

<template>
  <InventoryDashboard />
</template>
