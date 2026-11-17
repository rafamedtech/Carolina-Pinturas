<script setup lang="ts">
definePageMeta({
  middleware: (to) => {
    if (to.query.tab !== 'warehouses' || useAuth().user.value?.role !== 'admin') return

    return navigateTo({
      path: '/configuracion',
      query: {
        tab: 'inventory',
        search: to.query.search,
        tracking: to.query.tracking,
        productId: to.query.productId,
        page: to.query.page
      }
    }, { replace: true })
  }
})
</script>

<template>
  <InventoryDashboard />
</template>
