<script setup lang="ts">
definePageMeta({
  middleware: to => navigateTo({
    path: '/ventas',
    query: { ...to.query, view: 'internos' }
  }, { replace: true })
})
</script>

<template>
  <div />
</template>
