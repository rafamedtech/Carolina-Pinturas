// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import OrderSiigoInvoiceCard from '~/components/orders/siigo/OrderSiigoInvoiceCard.vue'
import OrderSiigoInvoiceModal from '~/components/orders/siigo/OrderSiigoInvoiceModal.vue'
import type { OrderSiigoInvoiceContext } from '~/types/siigo-invoices'
import type { SiigoCustomer } from '~/types/siigo'

const invoiceId = '63f918c2-ca65-4edc-a7db-66bcdd5159fb'
let existingChecks = 0
let missingChecks = 0
let wrapper: VueWrapper | null = null

const readyCustomer: SiigoCustomer = {
  id: '6b6ceb28-b2eb-4b98-b3dd-26648a933c81',
  name: ['Cliente fiscal'],
  person_type: 'Moral',
  rfc_id: 'PIN900101AB1',
  fiscal_regime: '601',
  active: true,
  address: {
    street: 'Calle 5',
    postal_code: '22000',
    city: { country_code: 'Mx', state_code: '2', city_code: '4' }
  }
}

function context(invoice: OrderSiigoInvoiceContext['invoice']): OrderSiigoInvoiceContext {
  return {
    writeEnabled: true,
    requiresInvoice: true,
    eligible: true,
    eligibilityMessage: null,
    orderNumber: 'PED-000012',
    orderDate: '2026-08-18',
    orderTotal: 1780,
    customerName: 'Cliente fiscal',
    customerRfc: 'VAGR8902073DA',
    customer: invoice?.status === 'created' ? null : readyCustomer,
    customerReadyForInvoice: invoice?.status !== 'created',
    missingCustomerFields: [],
    invoice,
    documentTypes: invoice?.status === 'created'
      ? []
      : [{
          id: 59625,
          code: 'FV',
          name: 'Factura',
          active: true,
          automatic_number: true,
          discount_type: 'Percentage'
        }],
    sellers: invoice?.status === 'created'
      ? []
      : [
          { id: 100, name: 'Vendedor alterno', email: null, active: true },
          { id: 788, name: 'Alexis Córdova', email: null, active: true }
        ],
    paymentTypes: invoice?.status === 'created'
      ? []
      : [
          { id: 1000, name: 'Transferencia', active: true },
          { id: 3558, name: '01-Efectivo', active: true },
          { id: 3564, name: 'Crédito Clientes', type: 'Cartera', active: true, due_date: true }
        ],
    costCenters: [],
    warehouses: []
  }
}

registerEndpoint('/api/orders/existing-invoice/siigo-invoice/context', () => {
  existingChecks++
  return context({
    status: 'created',
    siigoInvoiceId: invoiceId,
    siigoInvoiceName: 'FV-1-12',
    total: 1780,
    invoiceDate: '2026-08-18',
    lastError: null,
    createdBy: { name: 'Administrador', email: 'admin@example.com' },
    requestedAt: '2026-08-18T20:00:00.000Z'
  })
})

registerEndpoint('/api/orders/missing-invoice/siigo-invoice/context', () => {
  missingChecks++
  return context({
    status: 'failed',
    siigoInvoiceId: null,
    siigoInvoiceName: null,
    total: 1780,
    invoiceDate: '2026-08-18',
    lastError: 'La factura registrada ya no existe en Siigo. Puedes crear un nuevo borrador.',
    createdBy: { name: 'Administrador', email: 'admin@example.com' },
    requestedAt: '2026-08-18T20:00:00.000Z'
  })
})

registerEndpoint('/api/orders/incomplete-customer/siigo-invoice/context', () => {
  return {
    ...context(null),
    customer: {
      ...readyCustomer,
      fiscal_regime: undefined,
      address: undefined
    },
    customerReadyForInvoice: true,
    missingCustomerFields: []
  }
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  existingChecks = 0
  missingChecks = 0
  document.body.innerHTML = ''
  clearNuxtData()
})

describe('OrderSiigoInvoiceCard', () => {
  it('verifica al montar y no muestra el formulario si la factura existe', async () => {
    wrapper = await mountSuspended(OrderSiigoInvoiceCard, {
      props: { orderId: 'existing-invoice', open: false, checking: false }
    })

    await vi.waitFor(() => expect(wrapper?.emitted('checked')).toHaveLength(1))
    expect(existingChecks).toBe(1)
    await wrapper.setProps({ open: true })

    expect(existingChecks).toBe(1)
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
    expect(document.body.textContent).not.toContain('Crear factura borrador en Siigo')
  })

  it('abre el formulario cuando el servidor confirmó que la factura fue eliminada', async () => {
    wrapper = await mountSuspended(OrderSiigoInvoiceCard, {
      props: { orderId: 'missing-invoice', open: false, checking: false }
    })

    await vi.waitFor(() => expect(wrapper?.emitted('checked')).toHaveLength(1))
    expect(missingChecks).toBe(1)
    await wrapper.setProps({ open: true })

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Crear factura borrador en Siigo')
    })
    expect(document.body.textContent).toContain('Condición de pago')
    expect(document.body.textContent).toContain('Forma de pago CFDI')
    expect(document.body.textContent).toContain('Método de pago CFDI')
    expect(wrapper.emitted('checked')).toHaveLength(1)
    const invoiceModal = wrapper.findComponent(OrderSiigoInvoiceModal)
    const invoiceFields = new Map(invoiceModal.findAllComponents({ name: 'UFormField' }).map(field => [
      field.props('name'),
      field.props('label')
    ]))
    expect(invoiceFields.get('paymentTypeId')).toBe('Método de pago CFDI')
    expect(invoiceFields.get('paymentMethod')).toBe('Condición de pago')
    const selectedCatalogIds = invoiceModal
      .findAllComponents({ name: 'USelectMenu' })
      .map(component => component.props('modelValue'))
    expect(selectedCatalogIds).toContain(3564)
    expect(selectedCatalogIds).toContain(788)
  })

  it('abre la factura con los datos actuales de Siigo sin exigir ni modificar el domicilio', async () => {
    wrapper = await mountSuspended(OrderSiigoInvoiceCard, {
      props: { orderId: 'incomplete-customer', open: false, checking: false }
    })

    await vi.waitFor(() => expect(wrapper?.emitted('checked')).toHaveLength(1))
    await wrapper.setProps({ open: true })
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Crear factura borrador en Siigo')
    })
    expect(wrapper.findComponent(OrderSiigoInvoiceModal).exists()).toBe(true)
  })
})
