// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, defineEventHandler, readBody } from 'h3'
import type { VueWrapper } from '@vue/test-utils'
import OrderItemDeleteModal from '~/components/orders/OrderItemDeleteModal.vue'
import type { SalesOrderItem } from '~/types/orders'

const item = { id: 'item-delete', code: 'P-01', name: 'Pintura', quantity: 2 } as SalesOrderItem
let body: unknown
let fail = false
let requests = 0
registerEndpoint('/api/orders/order-delete/items/item-delete', {
  method: 'DELETE',
  handler: defineEventHandler(async (event) => {
    requests++
    body = await readBody(event)
    if (fail) throw createError({ statusCode: 409, statusMessage: 'El pedido ya está facturado.' })
    return { id: item.id }
  })
})
let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  body = undefined
  fail = false
  requests = 0
})
async function mountModal() {
  wrapper = await mountSuspended(OrderItemDeleteModal, {
    props: { open: false, orderId: 'order-delete', item, version: 3, inventoryDispatched: true }
  })
  await wrapper.setProps({ open: true })
  await vi.waitFor(() => expect(document.body.textContent).toContain('La salida de inventario se conservará.'))
  return wrapper
}
function confirmDeletion() {
  const button = [...document.body.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Eliminar partida')
  if (!button) throw new Error('No se encontró la confirmación.')
  button.click()
}

describe('OrderItemDeleteModal', () => {
  it('solicita confirmación antes de enviar y notifica la eliminación', async () => {
    const mounted = await mountModal()
    expect(requests).toBe(0)
    confirmDeletion()
    await vi.waitFor(() => expect(mounted.emitted('deleted')).toEqual([[item.id]]))
    expect(body).toEqual({ version: 3 })
    expect(mounted.emitted('update:open')?.at(-1)).toEqual([false])
  })
  it('conserva el modal y muestra el rechazo del servidor', async () => {
    fail = true
    const mounted = await mountModal()
    confirmDeletion()
    await vi.waitFor(() => expect(document.body.textContent).toContain('El pedido ya está facturado.'))
    expect(mounted.emitted('deleted')).toBeUndefined()
    expect(mounted.emitted('update:open')).toBeUndefined()
  })
})
