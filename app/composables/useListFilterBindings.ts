import type { Ref } from 'vue'
import type { ListFilterValues } from '~/types/list'

/** Adapt existing query refs to the layout without duplicating their state. */
export function useListFilterBindings(bindings: Record<string, Ref<string> | Ref<boolean>>) {
  return computed<ListFilterValues>({
    get: () => Object.fromEntries(Object.entries(bindings).map(([key, value]) => [key, value.value])),
    set: (values) => {
      for (const [key, binding] of Object.entries(bindings)) {
        const value = values[key]
        if (typeof binding.value === 'boolean' && typeof value === 'boolean') binding.value = value
        else if (typeof binding.value === 'string' && typeof value === 'string') binding.value = value
      }
    }
  })
}
