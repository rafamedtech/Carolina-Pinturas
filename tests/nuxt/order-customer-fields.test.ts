// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import type { ComponentPublicInstance } from 'vue'
import { USelectMenu } from '#components'
import OrderCustomerFields from '~/components/orders/OrderCustomerFields.vue'
import OrderCustomerCreateModal from '~/components/orders/OrderCustomerCreateModal.vue'
import type { SiigoCustomer } from '~/types/siigo'

const existingCustomer: SiigoCustomer = {
  id: 'existente-id',
  name: ['Pinturas', 'Centro'],
  rfc_id: 'PIN900101AB1',
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

let wrapper: VueWrapper | null = null

async function mountFields() {
  wrapper = await mountSuspended(OrderCustomerFields, {
    props: {
      customers: [existingCustomer],
      statuses: [],
      repartidores: [],
      loading: false,
      disabled: false,
      customerId: '',
      statusKey: 'borrador',
      repartidorId: '',
      orderDate: '2026-07-06',
      promisedDate: '',
      paymentStatus: 'pendiente_pago',
      paymentMethod: '',
      paymentDate: '',
      observations: ''
    }
  })
  return wrapper
}

function customerSelect(mounted: VueWrapper) {
  // El primer USelectMenu del formulario es el selector de cliente.
  return mounted.findAllComponents(USelectMenu)[0] as unknown as VueWrapper<ComponentPublicInstance>
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('OrderCustomerFields', () => {
  it('habilita crear cliente incluso con coincidencias parciales, con position explícito', async () => {
    // `when: 'empty'` solo la muestra si el filtro no arroja NADA: un cliente
    // existente con nombre/RFC parecido la esconde y bloquea el alta. `always`
    // la deja disponible salvo que el texto sea un duplicado exacto.
    // `position` es obligatorio: en esta versión de Nuxt UI, createItemPosition
    // solo cae en "bottom" cuando createItem NO es objeto; con objeto sin
    // position explícito queda undefined y el ítem nunca se renderiza (ver el
    // siguiente test, que lo prueba contra el DOM real).
    const mounted = await mountFields()
    expect(customerSelect(mounted).props()).toMatchObject({
      createItem: { when: 'always', position: 'bottom' }
    })
  })

  it('muestra "Crear cliente" en el menú real aunque el texto coincida parcialmente con un cliente existente', async () => {
    // El cliente existente se llama "Pinturas Centro": buscar solo "Pinturas"
    // produce una coincidencia parcial. Con when:'empty' esto escondería la
    // opción de crear aunque no exista ningún cliente llamado solo "Pinturas".
    const mounted = await mountFields()

    await mounted.find('[data-slot="base"]').trigger('click')
    await nextTick()

    const searchInput = await vi.waitFor(() => {
      const input = document.body.querySelector('[data-slot="content"] input')
      if (!(input instanceof HTMLInputElement)) throw new Error('El buscador del menú aún no aparece.')
      return input
    })

    searchInput.value = 'Pinturas'
    searchInput.dispatchEvent(new Event('input', { bubbles: true }))

    await vi.waitFor(() => {
      const text = document.body.querySelector('[data-slot="content"]')?.textContent || ''
      if (!text.includes('Crear cliente')) throw new Error(`Contenido actual: "${text}"`)
    })

    const content = document.body.querySelector('[data-slot="content"]')
    expect(content?.textContent).toContain('Pinturas Centro')
    expect(content?.textContent).toContain('Crear cliente')
    expect(content?.textContent).toContain('Pinturas')

    // La opción debe ser accionable (dos grupos: coincidencia + crear), no
    // solo texto decorativo.
    expect(content?.querySelectorAll('[role="group"]')).toHaveLength(2)

    const createOption = [...(content?.querySelectorAll('[role="option"]') || [])]
      .find(option => option.textContent?.includes('Crear cliente'))
    expect(createOption).toBeTruthy()

    createOption!.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }))
    createOption!.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))
    await nextTick()

    const modal = mounted.findComponent(OrderCustomerCreateModal)
    expect(modal.props('open')).toBe(true)
    expect(modal.props('initialName')).toBe('Pinturas')
  })

  it('abre el modal de alta con el texto buscado al elegir crear', async () => {
    const mounted = await mountFields()

    customerSelect(mounted).vm.$emit('create', '  Nueva Pintura  ')
    await nextTick()

    const modal = mounted.findComponent(OrderCustomerCreateModal)
    expect(modal.props('open')).toBe(true)
    expect(modal.props('initialName')).toBe('Nueva Pintura')
  })

  it('selecciona en el pedido al cliente recién creado y notifica al editor', async () => {
    const mounted = await mountFields()
    const created: SiigoCustomer = { id: 'nuevo-id', name: ['María', 'López'] }

    customerSelect(mounted).vm.$emit('create', 'María')
    await nextTick()
    mounted.findComponent(OrderCustomerCreateModal).vm.$emit('created', created)
    await nextTick()

    expect(mounted.emitted('update:customerId')).toEqual([['nuevo-id']])
    expect(mounted.emitted('customerCreated')).toEqual([[created]])
  })

  it('no altera la selección del pedido mientras el alta no se complete', async () => {
    const mounted = await mountFields()

    customerSelect(mounted).vm.$emit('create', 'María')
    await nextTick()

    // El modal quedó abierto sin emitir `created` (p. ej. un error de Siigo):
    // los datos del pedido no deben cambiar.
    expect(mounted.findComponent(OrderCustomerCreateModal).props('open')).toBe(true)
    expect(mounted.emitted('update:customerId')).toBeUndefined()
    expect(mounted.emitted('customerCreated')).toBeUndefined()
  })
})
