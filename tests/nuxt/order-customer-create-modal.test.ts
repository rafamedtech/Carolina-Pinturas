// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, defineEventHandler, readBody } from 'h3'
import type { VueWrapper } from '@vue/test-utils'
import OrderCustomerCreateModal from '~/components/orders/OrderCustomerCreateModal.vue'
import type { SiigoCustomer } from '~/types/siigo'

const existingCustomer: SiigoCustomer = {
  id: 'existente-id',
  name: ['Pinturas', 'Centro'],
  address: {
    street: 'Calle 5',
    city: {
      country_code: 'MX',
      state_code: '9',
      city_code: '1',
      city_name: 'Ciudad de México',
      state_name: 'CDMX'
    }
  }
}

let respond: (body: unknown) => SiigoCustomer | Promise<SiigoCustomer>
let receivedBody: unknown

registerEndpoint('/api/siigo/customers', {
  method: 'POST',
  handler: defineEventHandler(async (event) => {
    receivedBody = await readBody(event)
    return respond(receivedBody)
  })
})

let wrapper: VueWrapper | null = null

async function mountModal() {
  wrapper = await mountSuspended(OrderCustomerCreateModal, {
    props: {
      open: false,
      customers: [existingCustomer],
      initialName: 'María'
    }
  })
  await wrapper.setProps({ open: true })
  await vi.waitFor(() => {
    if (!document.body.querySelector('form')) throw new Error('El formulario del modal aún no aparece.')
  })
  return wrapper
}

function inputByLabel(text: string): HTMLInputElement {
  const label = [...document.body.querySelectorAll('label')]
    .find(item => item.textContent?.trim().startsWith(text))
  const input = label && document.getElementById(label.htmlFor)
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`No se encontró el campo "${text}".`)
  }
  return input
}

function fillInput(label: string, value: string) {
  const input = inputByLabel(label)
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function submitForm() {
  const form = document.body.querySelector('form')!
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

async function fillAndSubmitValidForm() {
  // "Nombres" llega prellenado desde initialName; se completa el resto.
  fillInput('Apellidos', 'López')
  fillInput('RFC', 'LOMA850101AB1')
  fillInput('Calle', 'Av. Reforma 123')
  await nextTick()
  await submitForm()
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  receivedBody = undefined
})

describe('OrderCustomerCreateModal', () => {
  it('prellena el nombre buscado y crea el cliente seleccionándolo en el pedido', async () => {
    const created: SiigoCustomer = { id: 'nuevo-id', name: ['María', 'López'] }
    respond = () => created

    const mounted = await mountModal()
    expect(inputByLabel('Nombres').value).toBe('María')

    await fillAndSubmitValidForm()
    await vi.waitFor(() => {
      if (!mounted.emitted('created')) throw new Error('Aún no se emite created.')
    })

    expect(mounted.emitted('created')).toEqual([[created]])
    // El modal se cierra al terminar.
    expect(mounted.emitted('update:open')?.at(-1)).toEqual([false])
    // La ciudad se tomó de los clientes existentes y el payload usa el contrato interno.
    expect(receivedBody).toMatchObject({
      personType: 'Physical',
      name: ['María', 'López'],
      rfcId: 'LOMA850101AB1',
      address: {
        street: 'Av. Reforma 123',
        city: { countryCode: 'MX', stateCode: '9', cityCode: '1' }
      }
    })
  })

  it('muestra el error de Siigo sin cerrar el modal ni perder lo capturado', async () => {
    respond = () => {
      throw createError({ statusCode: 400, statusMessage: 'El RFC no es válido según Siigo.' })
    }

    const mounted = await mountModal()
    await fillAndSubmitValidForm()

    await vi.waitFor(() => {
      if (!document.body.textContent?.includes('No se pudo crear el cliente')) {
        throw new Error('Aún no aparece la alerta de error.')
      }
    })

    expect(document.body.textContent).toContain('El RFC no es válido según Siigo.')
    // El modal sigue abierto y conserva todos los datos capturados.
    expect(mounted.emitted('update:open')).toBeUndefined()
    expect(mounted.emitted('created')).toBeUndefined()
    expect(inputByLabel('Nombres').value).toBe('María')
    expect(inputByLabel('Apellidos').value).toBe('López')
    expect(inputByLabel('RFC').value).toBe('LOMA850101AB1')
    expect(inputByLabel('Calle').value).toBe('Av. Reforma 123')
  })
})
