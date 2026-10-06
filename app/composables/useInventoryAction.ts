import { inventoryCommand, type InventoryCommand } from '#shared/schemas/inventory'

export function useInventoryAction(onSaved: (result: unknown, command: InventoryCommand['command']) => Promise<unknown> | unknown) {
  const busy = shallowRef(false)
  const error = shallowRef('')
  let pending: { requestId: string, command: InventoryCommand['command'], key: string } | null = null
  async function run(command: InventoryCommand['command']) {
    if (busy.value) return false
    const key = JSON.stringify(command)
    if (!pending || pending.key !== key) pending = { requestId: crypto.randomUUID(), command, key }
    const parsed = inventoryCommand.safeParse(pending)
    if (!parsed.success) {
      error.value = parsed.error.issues[0]?.message ?? 'Revisa los datos del inventario.'
      return false
    }
    busy.value = true
    error.value = ''
    try {
      const result = await $fetch('/api/inventory/actions', { method: 'POST', body: parsed.data })
      await onSaved(result, command)
      pending = null
      return true
    } catch (e) {
      error.value = (e as { data?: { statusMessage?: string } }).data?.statusMessage ?? 'No se pudo guardar. Intenta nuevamente.'
      return false
    } finally { busy.value = false }
  }
  return { busy, error, run }
}
