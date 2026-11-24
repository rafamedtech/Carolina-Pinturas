// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, defineEventHandler, readBody } from 'h3'
import type { VueWrapper } from '@vue/test-utils'
import OrderCancelModal from '~/components/orders/OrderCancelModal.vue'
import type { SalesOrderDetail } from '~/types/orders'

const cancelledOrder = {
  id: 'order-1',
  number: 'PED-0001',
  version: 4,
  status: {
    key: 'cancelado',
    label: 'Cancelado',
    color: 'error',
    sortOrder: 90,
    isTerminal: true
  }
} as SalesOrderDetail

let receivedBody: unknown
let requests = 0
let firstResponse: Promise<void> | undefined

registerEndpoint('/api/orders/order-1/status', {
  method: 'PATCH',
  handler: defineEventHandler(async (event) => {
    requests += 1
    receivedBody = await readBody(event)
    if (firstResponse && requests === 1) {
      await firstResponse
      throw createError({ statusCode: 409, statusMessage: 'El pedido cambió. Intenta de nuevo.' })
    }
    return cancelledOrder
  })
})

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  receivedBody = undefined
  requests = 0
  firstResponse = undefined
})

describe('OrderCancelModal', () => {
  it('confirma la cancelación y devuelve el pedido actualizado', async () => {
    wrapper = await mountSuspended(OrderCancelModal, {
      props: {
        open: false,
        orderId: 'order-1',
        orderNumber: 'PED-0001',
        version: 3
      }
    })

    await wrapper.setProps({ open: true })
    await vi.waitFor(() => {
      if (!document.body.textContent?.includes('El pedido quedará marcado como cancelado')) {
        throw new Error('El modal de confirmación aún no aparece.')
      }
    })

    const confirmButton = [...document.body.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === 'Cancelar pedido')

    if (!(confirmButton instanceof HTMLButtonElement)) {
      throw new TypeError('No se encontró el botón para cancelar el pedido.')
    }

    confirmButton.click()

    await vi.waitFor(() => {
      if (!wrapper?.emitted('cancelled')) throw new Error('Aún no se emite cancelled.')
    })

    expect(receivedBody).toEqual({
      statusKey: 'cancelado',
      note: 'Pedido cancelado desde el menú de opciones.',
      version: 3
    })
    expect(wrapper.emitted('cancelled')).toEqual([[cancelledOrder]])
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('permite conservar el pedido sin enviar la operación', async () => {
    wrapper = await mountSuspended(OrderCancelModal, {
      props: { open: true, orderId: 'order-1', orderNumber: 'PED-0001', version: 3 }
    })

    const cancelButton = await vi.waitFor(() => {
      const button = [...document.body.querySelectorAll('button')]
        .find(button => button.textContent?.trim() === 'Conservar pedido')
      if (!button) throw new Error('No se encontró el botón para conservar el pedido.')
      return button
    })
    cancelButton.click()

    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(wrapper.emitted('cancelled')).toBeUndefined()
    expect(requests).toBe(0)
  })

  it('bloquea envíos duplicados y conserva el motivo al reintentar', async () => {
    const response = Promise.withResolvers<undefined>()
    firstResponse = response.promise
    wrapper = await mountSuspended(OrderCancelModal, {
      props: { open: true, orderId: 'order-1', orderNumber: 'PED-0001', version: 3 }
    })

    const field = await vi.waitFor(() => {
      const textarea = document.body.querySelector('textarea')
      if (!textarea) throw new Error('No se encontró el campo de motivo.')
      return textarea
    })
    field.value = '  El cliente pidió cancelar.  '
    field.dispatchEvent(new Event('input', { bubbles: true }))

    const buttons = [...document.body.querySelectorAll('button')]
    const confirmButton = buttons.find(button => button.textContent?.trim() === 'Cancelar pedido')!
    const cancelButton = buttons.find(button => button.textContent?.trim() === 'Conservar pedido')!
    confirmButton.click()
    confirmButton.click()

    try {
      await vi.waitFor(() => expect(requests).toBe(1))
      expect(confirmButton.disabled).toBe(true)
      expect(cancelButton.disabled).toBe(true)
      expect(field.disabled).toBe(true)
      expect(wrapper.emitted('update:open')).toBeUndefined()
    } finally {
      response.resolve(undefined)
    }

    await vi.waitFor(() => expect(wrapper?.emitted('failed')).toEqual([[]]))
    expect(document.body.querySelector('[role="alert"]')?.textContent).toContain('El pedido cambió. Intenta de nuevo.')
    expect(field.value).toBe('  El cliente pidió cancelar.  ')
    expect(confirmButton.disabled).toBe(false)
    expect(wrapper.emitted('update:open')).toBeUndefined()

    confirmButton.click()
    await vi.waitFor(() => expect(wrapper?.emitted('cancelled')).toEqual([[cancelledOrder]]))
    expect(requests).toBe(2)
    expect(receivedBody).toEqual({ statusKey: 'cancelado', note: 'El cliente pidió cancelar.', version: 3 })
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })
})
