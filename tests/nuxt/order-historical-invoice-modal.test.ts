// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, defineEventHandler, readBody } from 'h3'
import type { VueWrapper } from '@vue/test-utils'
import OrderHistoricalInvoiceModal from '~/components/orders/siigo/OrderHistoricalInvoiceModal.vue'

const oldId = '63f918c2-ca65-4edc-a7db-66bcdd5159fb'
const newId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
let contextFails = false
let body: unknown
let wrapper: VueWrapper | null = null
registerEndpoint('/api/orders/historical-modal/siigo-invoice/legacy-context', defineEventHandler(() => {
  if (contextFails) throw createError({ statusCode: 502, statusMessage: 'Siigo no disponible' })
  return {
    orderNumber: 'PED-1', orderTotal: 100, customerName: 'Cliente',
    invoices: [oldId, newId].map((id, i) => ({ id, name: `FV-${i + 1}`, date: '2026-10-13', total: 100, stampStatus: 'Accepted' }))
  }
}))
for (const method of ['POST', 'DELETE'] as const) {
  registerEndpoint('/api/orders/historical-modal/siigo-invoice/legacy-assignment', {
    method,
    handler: defineEventHandler(async (event) => {
      body = await readBody(event)
      return { id: 'historical-modal', siigoReference: method === 'DELETE' ? null : newId, version: 4 }
    })
  })
}
function button(label: string) {
  const found = [...document.body.querySelectorAll('button')].find(item => item.textContent?.trim() === label)
  if (!found) throw new Error(`No se encontró ${label}`)
  return found
}
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  body = undefined
  contextFails = false
  document.body.innerHTML = ''
  clearNuxtData()
})
async function mountModal() {
  wrapper = await mountSuspended(OrderHistoricalInvoiceModal, {
    props: { open: false, orderId: 'historical-modal', invoiceId: oldId, version: 3 }
  })
  await wrapper.setProps({ open: true })
}
describe('modal de factura anterior', () => {
  it('muestra la asignación actual y permite cambiarla', async () => {
    await mountModal()
    await vi.waitFor(() => expect(document.body.textContent).toContain('FV-1'))
    expect(button('Cambiar factura').disabled).toBe(false)
    expect(document.body.textContent).not.toContain('no podrá reemplazarse')
    wrapper!.findComponent({ name: 'UForm' }).vm.$emit('submit', { data: { invoiceId: newId, confirmed: true } })
    await vi.waitFor(() => expect(wrapper!.emitted('assigned')).toBeDefined())
    expect(body).toEqual({ version: 3, invoiceId: newId, confirmation: 'ASIGNAR_FACTURA_HISTORICA' })
  })
  it('permite quitar la factura aunque falle la consulta de compatibles', async () => {
    contextFails = true
    await mountModal()
    await vi.waitFor(() => expect(document.body.textContent).toContain('No se pudieron consultar las facturas'))
    button('Quitar factura asignada').click()
    await vi.waitFor(() => expect(document.body.textContent).toContain('¿Quitar la factura asignada?'))
    expect(body).toBeUndefined()
    button('Confirmar quitar factura').click()
    await vi.waitFor(() => expect(wrapper!.emitted('assigned')).toBeDefined())
    expect(body).toEqual({ version: 3, confirmation: 'QUITAR_FACTURA_ASIGNADA' })
    expect(wrapper!.emitted('update:open')?.at(-1)).toEqual([false])
  })
})
