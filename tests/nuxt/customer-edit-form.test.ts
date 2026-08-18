// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import CustomerEditForm from '~/components/customers/CustomerEditForm.vue'
import type { SiigoCustomer } from '~/types/siigo'
import { SAT_FISCAL_REGIMES } from '~/utils/satFiscalRegimes'
import { siigoMexicoCityOptions } from '~/utils/siigoMexicoCities'
import { SIIGO_MEXICO_STATES } from '~/utils/siigoMexicoStates'

const customer: SiigoCustomer = {
  id: '6b6ceb28-b2eb-4b98-b3dd-26648a933c81',
  name: ['Pinturas Industriales SA de CV'],
  person_type: 'Moral',
  rfc_id: 'PIN900101AB1',
  active: true,
  commercial_name: 'Pinturas Industriales',
  fiscal_regime: '601',
  contacts: [{ email: 'ventas@example.com' }],
  phones: [{ number: '6641234567' }],
  address: {
    street: 'Calle 5',
    city: { country_code: 'US', state_code: '02', city_code: '004' }
  },
  internal: {
    code: 'CLI-001',
    notes: 'Cuenta de mayoreo',
    tags: ['mayoreo', 'crédito'],
    requires_invoice: true,
    sync_status: 'synced',
    sync_version: 1,
    synced_at: '2026-08-18T00:00:00.000Z'
  }
}

let wrapper: VueWrapper | null = null

function inputByLabel(text: string): HTMLInputElement {
  const label = wrapper?.findAll('label')
    .find(item => item.text().trim().startsWith(text))
  const id = label?.attributes('for')
  const input = id && wrapper?.element.querySelector(`[id="${id}"]`)
  if (!(input instanceof HTMLInputElement)) throw new Error(`No se encontró ${text}.`)
  return input
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('CustomerEditForm', () => {
  it('precarga PostgreSQL y emite el payload completo para guardar en ambos sistemas', async () => {
    wrapper = await mountSuspended(CustomerEditForm, {
      props: { customer, activeOverride: false }
    })

    expect(inputByLabel('Razón social').value).toBe('Pinturas Industriales SA de CV')
    expect(inputByLabel('Código interno').value).toBe('CLI-001')
    expect(inputByLabel('Etiquetas').value).toBe('mayoreo, crédito')
    const invoiceSwitch = wrapper.findAllComponents({ name: 'USwitch' })
      .find(component => component.props('label') === 'Requiere factura')
    expect(invoiceSwitch?.props('modelValue')).toBe(true)
    expect(wrapper.text()).toContain('601 · General de Ley Personas Morales')
    expect(wrapper.text()).toContain('2 · Baja California')
    expect(wrapper.text()).toContain('4 · Tijuana')
    expect(wrapper.text()).not.toContain('Código de país Siigo')
    expect(wrapper.text()).toContain('Información fiscal y de contacto')
    expect(wrapper.text()).toContain('Dirección')
    expect(wrapper.text()).not.toContain('Contacto y dirección')
    expect(wrapper.text()).toContain('Guardar cambios')
    expect(wrapper.text()).not.toContain('Guardar en Siigo y PostgreSQL')

    const cards = wrapper.findAllComponents({ name: 'UCard' })
    const fiscalAndContactCard = cards.find(card => card.text().includes('Información fiscal y de contacto'))
    const addressCard = cards.find(card => card.text().includes('Dirección'))
    const internalControlCard = cards.find(card => card.text().includes('Control interno'))
    expect(fiscalAndContactCard?.text()).toContain('Correo')
    expect(fiscalAndContactCard?.text()).toContain('Teléfono')
    expect(fiscalAndContactCard?.text()).toContain('Cliente activo')
    expect(fiscalAndContactCard?.text()).toContain('Requiere factura')
    expect(fiscalAndContactCard?.text()).not.toContain('Cliente activo en Siigo')
    expect(fiscalAndContactCard?.text()).not.toContain('Requiere factura por defecto')
    expect(fiscalAndContactCard?.text()).not.toContain('Facturación predeterminada')
    expect(fiscalAndContactCard?.text()).not.toContain('Activa Requiere factura al seleccionar este cliente en un pedido')
    expect(internalControlCard?.text()).not.toContain('Facturación predeterminada')
    const personTypeField = fiscalAndContactCard?.findAllComponents({ name: 'UFormField' })
      .find(field => field.props('name') === 'personType')
    const statusControls = fiscalAndContactCard?.find('[data-testid="customer-status-controls"]')
    expect(personTypeField?.element.parentElement).toBe(statusControls?.element.parentElement)
    const statusControlText = statusControls?.text() || ''
    expect(statusControlText.indexOf('Cliente activo'))
      .toBeLessThan(statusControlText.indexOf('Requiere factura'))
    expect(addressCard?.text()).not.toContain('Correo')
    expect(addressCard?.text()).not.toContain('Teléfono')

    const addressFields = addressCard?.findAllComponents({ name: 'UFormField' }) || []
    const addressFieldLabels = addressFields.map(field => field.props('label'))
    expect(addressFieldLabels.slice(6, 8)).toEqual(['Estado', 'Ciudad'])
    expect(addressFields.find(field => field.props('name') === 'cityCode')?.classes()).not.toContain('sm:col-span-2')

    const phoneInput = inputByLabel('Teléfono')
    expect(phoneInput.value).toBe('6641234567')
    expect(phoneInput.type).toBe('tel')
    expect(phoneInput.inputMode).toBe('numeric')
    expect(phoneInput.maxLength).toBe(10)

    await wrapper.find(`#${phoneInput.id}`).setValue('664a123-4567')
    expect(inputByLabel('Teléfono').value).toBe('6641234567')

    const longColony = 'Fraccionamiento Jardines del Valle Norte'
    await wrapper.find(`#${inputByLabel('Colonia').id}`).setValue(longColony)

    const selectMenus = wrapper.findAllComponents({ name: 'USelectMenu' })
    const fiscalRegimeSelect = selectMenus.find(component => component.props('items') === SAT_FISCAL_REGIMES)
    const stateSelect = selectMenus.find(component => component.props('items') === SIIGO_MEXICO_STATES)
    const citySelect = selectMenus.find(component => component.props('items')?.length === 5)
    if (!fiscalRegimeSelect || !stateSelect || !citySelect) throw new Error('No se encontraron los selectores fiscales y de ubicación.')

    expect(fiscalRegimeSelect.props('items')).toEqual(SAT_FISCAL_REGIMES)
    expect(fiscalRegimeSelect.props('valueKey')).toBe('value')
    expect(SAT_FISCAL_REGIMES).toHaveLength(19)
    expect(stateSelect.props('items')).toEqual(SIIGO_MEXICO_STATES)
    expect(stateSelect.props('valueKey')).toBe('value')
    expect(SIIGO_MEXICO_STATES).toHaveLength(32)
    expect(citySelect.props('items')).toEqual(siigoMexicoCityOptions('2'))
    expect(citySelect.props('modelValue')).toBe('4')

    wrapper.find('form').element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await vi.waitFor(() => {
      if (!wrapper?.emitted('submit')) throw new Error('Aún no se emite submit.')
    })

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      personType: 'Moral',
      name: ['PINTURAS INDUSTRIALES SA DE CV'],
      fiscalRegime: '601',
      phone: '6641234567',
      active: false,
      internal: {
        code: 'CLI-001',
        notes: 'Cuenta de mayoreo',
        tags: ['mayoreo', 'crédito'],
        requiresInvoice: true
      },
      address: {
        street: 'Calle 5',
        colony: longColony,
        city: { countryCode: 'Mx', stateCode: '2', cityCode: '4' }
      }
    })
  })

  it('no envía el formulario cuando el teléfono no tiene 10 dígitos', async () => {
    wrapper = await mountSuspended(CustomerEditForm, {
      props: { customer }
    })

    const phoneInput = inputByLabel('Teléfono')
    await wrapper.find(`#${phoneInput.id}`).setValue('6641234')
    wrapper.find('form').element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await vi.waitFor(() => {
      expect(wrapper?.text()).toContain('Usa un número telefónico de 10 dígitos.')
    })
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('habilita guardar únicamente mientras existan cambios', async () => {
    wrapper = await mountSuspended(CustomerEditForm, {
      props: { customer }
    })

    const saveButton = wrapper.findAllComponents({ name: 'UButton' })
      .find(button => button.props('label') === 'Guardar cambios')
    if (!saveButton) throw new Error('No se encontró el botón Guardar cambios.')

    expect(saveButton.props('disabled')).toBe(true)

    const commercialNameInput = inputByLabel('Nombre comercial')
    await wrapper.find(`#${commercialNameInput.id}`).setValue('Nuevo nombre comercial')
    expect(saveButton.props('disabled')).toBe(false)

    await wrapper.find(`#${commercialNameInput.id}`).setValue(customer.commercial_name)
    expect(saveButton.props('disabled')).toBe(true)

    wrapper.find('form').element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await nextTick()
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('actualiza las ciudades y limpia la selección al cambiar de estado', async () => {
    wrapper = await mountSuspended(CustomerEditForm, {
      props: { customer }
    })

    const selectMenus = wrapper.findAllComponents({ name: 'USelectMenu' })
    const stateSelect = selectMenus.find(component => component.props('items') === SIIGO_MEXICO_STATES)
    const citySelect = selectMenus.find(component => component.props('items')?.length === 5)
    if (!stateSelect || !citySelect) throw new Error('No se encontraron los selectores de ubicación.')

    stateSelect.vm.$emit('update:modelValue', '9')
    await nextTick()

    expect(citySelect.props('items')).toEqual(siigoMexicoCityOptions('9'))
    expect(citySelect.props('modelValue')).toBe('')
  })

  it('exige régimen fiscal y código postal en el modo previo a facturación', async () => {
    wrapper = await mountSuspended(CustomerEditForm, {
      props: {
        customer: {
          ...customer,
          fiscal_regime: undefined,
          address: { ...customer.address, postal_code: undefined }
        },
        invoiceMode: true
      }
    })

    expect(wrapper.text()).not.toContain('Control interno')
    expect(wrapper.text()).toContain('Guardar y continuar')
    wrapper.find('form').element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await vi.waitFor(() => {
      expect(wrapper?.text()).toContain('Selecciona el régimen fiscal.')
      expect(wrapper?.text()).toContain('El código postal fiscal debe tener 5 dígitos.')
    })
    expect(wrapper.emitted('submit')).toBeUndefined()
  })
})
