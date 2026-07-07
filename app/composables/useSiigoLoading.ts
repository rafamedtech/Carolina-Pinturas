import type { Ref } from 'vue'
import type { AsyncDataRequestStatus } from '#app'

// Estado global compartido: número de fetches de Siigo en curso. El overlay
// de carga a pantalla completa se muestra mientras el contador sea > 0.
export function useSiigoLoading() {
  const count = useState('siigo-loading-count', () => 0)

  return {
    count,
    isLoading: computed(() => count.value > 0)
  }
}

// Registra el `status` de un fetch de Siigo en el contador global: suma
// mientras está 'pending' y resta al terminar (o al desmontar el scope).
export function useTrackSiigoLoading(status: Ref<AsyncDataRequestStatus>) {
  const { count } = useSiigoLoading()
  let counted = false

  const begin = () => {
    if (!counted) {
      counted = true
      count.value++
    }
  }
  const end = () => {
    if (counted) {
      counted = false
      count.value--
    }
  }

  watch(status, (value) => {
    if (value === 'pending') begin()
    else end()
  }, { immediate: true })

  onScopeDispose(end)
}
