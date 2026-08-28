// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import OrderPaymentsCard from '~/components/orders/payments/OrderPaymentsCard.vue'
import type { OrderPaymentContext } from '~/types/siigo-payments'

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(() => ({
    user: { value: { role: 'admin' } }
  }))
}))
mockNuxtImport('useAuth', () => useAuthMock)

const context: OrderPaymentContext = {
  requiresInvoice: true,
  orderTotal: 110,
  paidTotal: 110,
  balance: 0,
  payments: [{
    id: 'payment-1',
    requestId: '19ee1240-591d-4b72-87da-ee034838553c',
    provider: 'local',
    externalStatus: 'not_applicable',
    externalError: null,
    paymentMethod: 'transferencia',
    amount: 110,
    currencyCode: 'MXN',
    paymentDate: '2026-08-18',
    reference: null,
    observations: null,
    siigo: null,
    createdBy: { name: 'Administrador', email: 'admin@example.com' },
    createdAt: '2026-08-18T12:00:00.000Z'
  }],
  siigo: {
    available: true,
    writeEnabled: true,
    unavailableReason: null,
    assignedInvoiceId: '313a93d7-218f-44dd-bbc5-5d3dba22936d',
    assignedInvoiceStamped: false,
    assignedInvoice: {
      id: '313a93d7-218f-44dd-bbc5-5d3dba22936d',
      name: 'FV-A-253',
      date: '2026-08-18',
      total: 110,
      balance: 110,
      customerId: '9bf22cf2-ba6b-4030-b9a6-3286ea440b61',
      customerRfc: 'VAGR8902073DA',
      stampStatus: 'Draft',
      stamped: false
    },
    documentTypes: [{ id: 69452, code: '1', name: 'Recibo', active: true }],
    paymentTypes: [{ id: 3560, name: '03 - Transferencia', active: true }],
    costCenters: []
  }
}

registerEndpoint('/api/orders/order-stamp/payments/context', () => context)

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  clearNuxtData()
})

describe('OrderPaymentsCard · timbrado', () => {
  it('deshabilita Registrar en Siigo mientras la factura siga en borrador', async () => {
    wrapper = await mountSuspended(OrderPaymentsCard, {
      props: { orderId: 'order-stamp' },
      global: {
        stubs: {
          UTooltip: { template: '<div><slot /></div>' }
        }
      }
    })

    await vi.waitFor(() => expect(wrapper?.text()).toContain('Registrar en Siigo'))
    const registerButton = wrapper.findAll('button')
      .find(button => button.text().trim() === 'Registrar en Siigo')
    expect(registerButton?.attributes('disabled')).toBeDefined()
  })

  it('oculta la asignación de pagos existentes mientras la factura siga en borrador', async () => {
    wrapper = await mountSuspended(OrderPaymentsCard, {
      props: { orderId: 'order-stamp' },
      global: {
        stubs: {
          UTooltip: { template: '<div><slot /></div>' }
        }
      }
    })

    await vi.waitFor(() => expect(wrapper?.text()).toContain('Registrar en Siigo'))
    expect(wrapper?.text()).not.toContain('Asignar pago de Siigo')
  })

  it('permite al administrador buscar un pago existente cuando la factura está timbrada', async () => {
    context.siigo.assignedInvoiceStamped = true
    context.siigo.assignedInvoice!.stampStatus = 'Accepted'
    context.siigo.assignedInvoice!.stamped = true
    wrapper = await mountSuspended(OrderPaymentsCard, {
      props: { orderId: 'order-stamp' },
      global: {
        stubs: {
          UTooltip: { template: '<div><slot /></div>' }
        }
      }
    })

    await vi.waitFor(() => expect(wrapper?.text()).toContain('Asignar pago de Siigo'))
  })
})
