// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  return wrapper!.findAllComponents({ name: 'UButton' }).find(button => button.props('label') === label || button.attributes('aria-label') === label)
}

describe('OrderPaymentsCard · asignar recepciones existentes', () => {
  it('ofrece asignar una recepción de la factura timbrada sin acciones de registro o enlaces externos', async () => {
    context.siigo.writeEnabled = false
    await mountPayments(true)
    expect(action('Asignar pago timbrado')).toBeDefined()
    const buttons = wrapper!.findAllComponents({ name: 'UButton' })
    expect(buttons.every(button => !button.props('to'))).toBe(true)
    expect(buttons.map(button => button.props('label')).join(' ')).not.toMatch(/timbrar|enlace|Siigo Nube/i)
    expect(wrapper?.findComponent({ name: 'OrderPaymentSiigoModal' }).exists()).toBe(false)
    // El registro local de abonos sigue disponible y es independiente de Siigo.
    expect(action('Agregar pago')).toBeDefined()
  })

  it('no permite asignar mientras la factura sigue en borrador', async () => {
    await mountPayments()
    expect(action('Asignar pago timbrado')).toBeUndefined()
  })

  it.each(['failed', 'unknown'] as const)('permite conciliar un intento %s sin repetir la creación fiscal', async (externalStatus) => {
    context.payments[0]!.provider = 'siigo'
    context.payments[0]!.externalStatus = externalStatus
    await mountPayments(true)
    expect(action('Asignar pago timbrado')).toBeDefined()
    expect(wrapper?.text()).not.toContain('Reintentar en Siigo')
  })

  it('mantiene bloqueado un pago reservado en curso', async () => {
    context.payments[0]!.provider = 'siigo'
    context.payments[0]!.externalStatus = 'pending'
    await mountPayments(true)
    expect(action('Asignar pago timbrado')).toBeUndefined()
  })

  it.each(['ya vinculada', 'otra factura'])('no ofrece asignación para una recepción %s', async (scenario) => {
    const payment = context.payments[0]!
    payment.provider = 'siigo'
    payment.externalStatus = 'failed'
    payment.siigo = {
      voucherId: scenario === 'ya vinculada' ? '497f6eca-6276-4993-bfeb-53cbbbba6f08' : null,
      voucherName: null,
      invoiceId: scenario === 'otra factura' ? 'e6403695-032f-4711-842b-dd7b95bcf008' : context.siigo.assignedInvoice!.id,
      invoiceName: 'FV-A-253',
      documentTypeId: 69452, paymentTypeId: 3560, costCenterId: null,
      cfdiCode: '03', paymentMethod: 'PPD', quote: 1
    }
    await mountPayments(true)
    expect(action('Asignar pago timbrado')).toBeUndefined()
  })
})
