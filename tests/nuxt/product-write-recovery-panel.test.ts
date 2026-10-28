// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import ProductWriteRecovery from '~/components/products/ProductWriteRecovery.vue'
import { productMutationInput } from '~/utils/siigoProductMutation'
import type { ProductWriteReview } from '~/types/siigo-products'

const id = '00000000-0000-4000-8000-000000000001'
const product = { id, code: 'PIN1', name: 'Pintura', type: 'Product', stock_control: false, key: { code: '31211500' }, account_group: { id: 10 } }
const input = { ...productMutationInput(product), name: 'Nombre pendiente', prices: [{ currency_code: 'MXN', price_list: [{ position: 1, value: 520 }] }] }
const context = { accountGroups: [{ id: 10, name: 'Pinturas', active: true }], taxes: [], priceLists: [{ id: 1, name: 'Precio regular', active: true }] }
let response: ProductWriteReview
let retryCalls = 0
let discardCalls = 0
let wrapper: VueWrapper | undefined
registerEndpoint('/api/siigo/products/write-review', { method: 'POST', handler: () => response })
registerEndpoint('/api/siigo/products/retry-write', { method: 'POST', handler: () => {
  retryCalls++
  return product
} })
registerEndpoint('/api/siigo/products/discard-write', { method: 'POST', handler: () => {
  discardCalls++
  return { productId: id }
} })
beforeEach(() => {
  retryCalls = 0
  discardCalls = 0
  response = {
    status: 'different', operationId: id, productId: id, input, isNew: false, componentLabels: {}, currentCompositionVersion: 2,
    differences: [{ field: 'prices', expected: input.prices, actual: [{ currency_code: 'MXN', price_list: [{ position: 1, value: 517 }] }] }],
    message: 'Revisa la comparación y elige cómo resolver los cambios pendientes.', availableAt: '2026-01-01T00:00:00Z', canRetry: true, canDiscard: true
  }
})
afterEach(() => wrapper?.unmount())
async function mountPanel() {
  wrapper = await mountSuspended(ProductWriteRecovery, { attachTo: document.body, props: { operationId: id, context } })
  await vi.waitFor(() => expect(wrapper!.text()).toContain('Cambios conservados'))
  return wrapper
}
async function confirm(label: string) {
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull())
  const button = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(item => item.textContent === label)!
  expect(button).toBeTruthy()
  button.click()
  await flushPromises()
}

describe('panel para resolver un guardado pendiente', () => {
  it('muestra precios legibles y no reenvía hasta confirmar la acción', async () => {
    const panel = await mountPanel()
    expect(panel.text()).toContain('Actual en Siigo')
    expect(panel.text()).toContain('Precio regular: 517.00 MXN')
    expect(panel.text()).toContain('Precio regular: 520.00 MXN')
    expect(retryCalls).toBe(0)
    await panel.findAll('button').find(button => button.text() === 'Volver a enviar cambios pendientes')!.trigger('click')
    expect(retryCalls).toBe(0)
    await confirm('Volver a enviar los cambios pendientes')
    await vi.waitFor(() => expect(panel.emitted('recovered')?.[0]).toEqual([product]))
    expect(retryCalls).toBe(1)
  })
  it('carga el borrador conservado con la versión interna actual sin escribir en Siigo', async () => {
    const panel = await mountPanel()
    await panel.findAll('button').find(button => button.text() === 'Cargar cambios para corregirlos')!.trigger('click')
    await confirm('Cargar los cambios para corregirlos')
    await vi.waitFor(() => expect(panel.emitted('resolved')?.[0]).toEqual([{ operationIds: [id], input: { ...input, composition: { ...input.composition, version: 2 } } }]))
    expect(discardCalls).toBe(1)
    expect(retryCalls).toBe(0)
  })
  it('explica qué hacer durante una caída y muestra los cambios que siguen conservados', async () => {
    response = { ...response, status: 'unavailable', message: 'El servicio de productos de Siigo no está disponible.', differences: [], canRetry: false, canDiscard: false }
    const panel = await mountPanel()
    expect(panel.text()).toContain('Nombre pendiente')
    expect(panel.text()).toContain('520.00 MXN')
    expect(panel.text()).toContain('Volveremos a comprobar automáticamente')
    expect(panel.findAll('button').some(button => button.text().includes('Volver a enviar'))).toBe(false)
    expect(retryCalls).toBe(0)
    expect(discardCalls).toBe(0)
  })
})
