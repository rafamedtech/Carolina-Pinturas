import type { PurchaseAction } from '#shared/schemas/purchase'
import type { PurchaseView } from '~/types/purchases'

export function usePurchaseAction(order: () => PurchaseView, saved: (value: PurchaseView) => void) {
  const busy = shallowRef(false)
  const error = shallowRef('')
  let pending: { key: string, requestId: string } | undefined
  async function run(command: PurchaseAction) {
    if (busy.value) return
    const current = order()
    const key = JSON.stringify({ command, version: current.version })
    if (pending?.key !== key) pending = { key, requestId: crypto.randomUUID() }
    busy.value = true
    error.value = ''
    try {
      const result = await $fetch<PurchaseView>(`/api/purchases/${current.id}/actions`, { method: 'POST', body: { command, version: current.version, requestId: pending.requestId } })
      pending = undefined
      saved(result)
      return true
    } catch (e) {
      error.value = (e as { data?: { statusMessage?: string } }).data?.statusMessage || 'No se pudo completar. Recarga para comprobar el estado antes de cambiar los datos.'
      return false
    } finally { busy.value = false }
  }
  return { busy, error, run }
}
