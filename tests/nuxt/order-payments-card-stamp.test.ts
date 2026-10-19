// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import OrderPaymentsCard from '~/components/orders/payments/OrderPaymentsCard.vue'
import { SIIGO_NUBE_DOCUMENTS_URL, SIIGO_NUBE_REGISTER_PAYMENT_URL } from '~/utils/siigoNube'
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

beforeEach(() => {
  context.siigo.assignedInvoiceStamped = false
  context.siigo.assignedInvoice!.stamped = false
  context.siigo.assignedInvoice!.stampStatus = 'Draft'
  context.siigo.writeEnabled = true
  context.payments[0]!.provider = 'local'
  context.payments[0]!.externalStatus = 'not_applicable'
  context.payments[0]!.siigo = null
})

async function mountPayments(stamped = false) {
  context.siigo.assignedInvoiceStamped = stamped
  context.siigo.assignedInvoice!.stamped = stamped
  context.siigo.assignedInvoice!.stampStatus = stamped ? 'Accepted' : 'Draft'
  wrapper = await mountSuspended(OrderPaymentsCard, {
    props: { orderId: 'order-stamp' },
    global: { stubs: { UTooltip: { template: '<div><slot /></div>' } } }
  })
  await vi.waitFor(() => expect(wrapper?.text()).toContain('Factura FV-A-253'))
  return wrapper
}

function action(label: string) {
  return wrapper!.findAllComponents({ name: 'UButton' }).find(button => button.props('label') === label)
}

describe('OrderPaymentsCard · registro en Siigo Nube', () => {
  it('deshabilita el registro y oculta la asignación mientras la factura sigue en borrador', async () => {
    await mountPayments()
    expect(action('Registrar pago en Siigo Nube')?.props('disabled')).toBe(true)
    expect(wrapper?.text()).not.toContain('Asignar pago de Siigo')
  })

  it('abre el formulario de Siigo en otra pestaña, sin formulario de timbrado de la aplicación', async () => {
    context.siigo.writeEnabled = false
    await mountPayments(true)
    const link = action('Registrar pago en Siigo Nube')
    expect(link?.props('to')).toBe(SIIGO_NUBE_REGISTER_PAYMENT_URL)
    expect(link?.props('target')).toBe('_blank')
    expect(link?.props('disabled')).toBe(false)
    expect(wrapper?.text()).toContain('Asignar pago de Siigo')
    expect(wrapper?.text()).toContain('el importe y la fecha de este pago')
    expect(wrapper?.text()).not.toContain('Crear y timbrar')
    expect(wrapper?.findComponent({ name: 'OrderPaymentSiigoModal' }).exists()).toBe(false)
  })

  it('un intento fallido sin recepción abre Siigo en lugar de repetir el POST fiscal', async () => {
    context.payments[0]!.provider = 'siigo'
    context.payments[0]!.externalStatus = 'failed'
    await mountPayments(true)
    expect(action('Registrar pago en Siigo Nube')?.props('to')).toBe(SIIGO_NUBE_REGISTER_PAYMENT_URL)
    expect(wrapper?.text()).not.toContain('Reintentar en Siigo')
  })

  it.each(['pending', 'unknown'] as const)('ofrece revisar documentos para un resultado %s', async (externalStatus) => {
    context.payments[0]!.provider = 'siigo'
    context.payments[0]!.externalStatus = externalStatus
    await mountPayments(true)
    expect(action('Revisar en Siigo Nube')?.props('to')).toBe(SIIGO_NUBE_DOCUMENTS_URL)
    expect(action('Registrar pago en Siigo Nube')).toBeUndefined()
  })

  it('una recepción existente se revisa en Siigo para evitar crear otra', async () => {
    const payment = context.payments[0]!
    payment.provider = 'siigo'
    payment.externalStatus = 'failed'
    payment.siigo = {
      voucherId: '497f6eca-6276-4993-bfeb-53cbbbba6f08', voucherName: 'RC-1-22',
      invoiceId: context.siigo.assignedInvoice!.id, invoiceName: 'FV-A-253',
      documentTypeId: 69452, paymentTypeId: 3560, costCenterId: null,
      cfdiCode: '03', paymentMethod: 'PPD', quote: 1
    }
    await mountPayments(true)
    expect(action('Revisar en Siigo Nube')?.props('to')).toBe(SIIGO_NUBE_DOCUMENTS_URL)
    expect(wrapper?.text()).not.toContain('Timbrar recepción')
  })
})
