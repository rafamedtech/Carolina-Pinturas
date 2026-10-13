import { computed, watch } from 'vue'
import { useRoute, useRouter } from '#app'
import type { Ref, WatchSource } from 'vue'
import type { LocationQueryRaw, Router } from 'vue-router'
import type { TableQueryBinding } from '~/utils/tableQuery'

// Merge patches from separate tables/controls on the same page before navigating.
const pendingQueries = new WeakMap<Router, { path: string, query: LocationQueryRaw }>()

function replaceTableQuery(router: Router, path: string, patch: LocationQueryRaw) {
  const pending = pendingQueries.get(router)
  if (pending?.path === path) {
    Object.assign(pending.query, patch)
    return
  }
  const update = { path, query: { ...patch } }
  pendingQueries.set(router, update)
  void Promise.resolve().then(() => {
    if (pendingQueries.get(router) !== update) return
    pendingQueries.delete(router)
    const current = router.currentRoute.value
    if (current.path !== path) return
    const query = Object.fromEntries(Object.entries({ ...current.query, ...update.query }).filter(([, value]) => value !== undefined))
    const target = { path, query, hash: current.hash }
    if (router.resolve(target).fullPath !== current.fullPath) void router.replace(target)
  })
}

export function useTableQuery(bindings: TableQueryBinding[], options: {
  page?: Ref<number>
  resetOn?: WatchSource[]
} = {}) {
  const route = useRoute()
  const router = useRouter()
  const path = route.path
  let restoring = false
  const read = () => {
    if (router.currentRoute.value.path !== path) return
    restoring = true
    try {
      for (const binding of bindings) binding.read(router.currentRoute.value.query)
    } finally {
      restoring = false
    }
  }
  const patch = () => Object.assign({}, ...bindings.map(binding => binding.write())) as LocationQueryRaw
  read()

  if (options.page && options.resetOn?.length) {
    watch(options.resetOn, () => {
      if (!restoring) options.page!.value = 1
    }, { flush: 'sync' })
  }
  watch(() => router.currentRoute.value, read, { flush: 'sync' })
  watch(patch, () => replaceTableQuery(router, path, patch()), { flush: 'post' })

  const returnTo = computed(() => router.resolve({
    path,
    query: { ...route.query, ...patch() },
    hash: route.hash
  }).fullPath)

  return { returnTo }
}
