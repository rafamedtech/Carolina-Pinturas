<script setup lang="ts">
withDefaults(defineProps<{
  rows?: number
  cols?: number
}>(), {
  rows: 8,
  cols: 5
})
</script>

<template>
  <div
    class="shrink-0 overflow-hidden rounded-lg border border-default"
    role="status"
    aria-busy="true"
  >
    <div
      class="grid gap-4 bg-elevated/50 px-3 py-2.5"
      :style="{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }"
    >
      <USkeleton v-for="col in cols" :key="`h-${col}`" class="h-4 w-2/3" />
    </div>

    <div class="divide-y divide-default">
      <div
        v-for="row in rows"
        :key="`r-${row}`"
        class="grid gap-4 px-3 py-3"
        :style="{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }"
      >
        <USkeleton v-for="col in cols" :key="`r-${row}-c-${col}`" class="h-4 w-full" />
      </div>
    </div>

    <span class="sr-only">Cargando…</span>
  </div>
</template>
