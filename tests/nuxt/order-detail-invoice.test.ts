// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineEventHandler, readBody } from 'h3'
import type { VueWrapper } from '@vue/test-utils'
import OrderDetail from '~/components/orders/OrderDetail.vue'
import type { SalesOrderDetail } from '~/types/orders'

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(() => {
    const user = {
      id: 'admin-1',
      name: 'Administrador',
      email: 'admin@example.com',
      role: 'admin' as const,
      repartidorId: null
    }
    return {
      user: { value: user },
      disabled: { value: false },
      fetchSession: vi.fn(async () => user)
    }
  })
}))

mockNuxtImport('useAuth', () => useAuthMock)

const baseOrder = {
  id: 'order-invoice',
  folio: 12,
  number: 'PED-000012',
  status: { key: 'entregado', label: 'Entregado', color: 'success', sortOrder: 80, isTerminal: false },
  customer: {
    id: '6b6ceb28-b2eb-4b98-b3dd-26648a933c81',
    name: 'Cliente fiscal',
    rfc: 'PIN900101AB1',
    phone: null,
    address: null
  },
  orderDate: '2026-08-18',
  promisedDate: null,
  total: 108,
  itemCount: 0,
  paymentStatus: 'pendiente_pago',
  paymentMethod: null,
  createdAt: '2026-08-18T00:00:00.000Z',
  updatedAt: '2026-08-18T00:00:00.000Z',
  observations: null,
  remision: null,
  requiresInvoice: false,
  isCounterSale: false,
  invoiceCreated: false,
  tags: [],
  paymentDate: null,
  currencyCode: 'MXN',
  subtotal: 100,
  discountType: 'porcentaje',
  discountValue: 0,
  discountAmount: 0,
  discountTotal: 0,
  taxTotal: 8,
  taxBreakdown: [{ name: 'IVA', percentage: 8, amount: 8 }],
  siigoReference: null,
  registeredInSiigoAt: null,
  version: 1,
  vendedor: { name: 'Administrador', email: 'admin@example.com' },
  repartidor: null,
  createdBy: { name: 'Administrador', email: 'admin@example.com', role: 'admin' },
  items: [],
  statusHistory: []
} satisfies SalesOrderDetail

let currentOrder: SalesOrderDetail = baseOrder
let receivedBody: unknown
let contextChecks = 0
let wrapper: VueWrapper | null = null

registerEndpoint('/api/orders/order-invoice', () => currentOrder)
registerEndpoint('/api/orders/statuses', () => [baseOrder.status])
registerEndpoint('/api/repartidores', () => [])
registerEndpoint('/api/orders/order-invoice/invoice-requirement', {
  method: 'PATCH',
  handler: defineEventHandler(async (event) => {
    receivedBody = await readBody(event)
    currentOrder = { ...currentOrder, requiresInvoice: true, version: 2 }
    return currentOrder
  })
})
registerEndpoint('/api/orders/order-invoice/siigo-invoice/context', () => {
  contextChecks++
  return {
    writeEnabled: true,
    requiresInvoice: true,
    eligible: true,
    eligibilityMessage: null,
    orderNumber: currentOrder.number,
    orderDate: currentOrder.orderDate,
    orderTotal: currentOrder.total,
    customerName: currentOrder.customer.name,
    customerRfc: currentOrder.customer.rfc,
    customer: null,
    customerReadyForInvoice: true,
    missingCustomerFields: [],
    invoice: {
      status: 'created',
      siigoInvoiceId: '63f918c2-ca65-4edc-a7db-66bcdd5159fb',
      siigoInvoiceName: 'FV-1-12',
      total: currentOrder.total,
      invoiceDate: currentOrder.orderDate,
      lastError: null,
      createdBy: { name: 'Administrador', email: 'admin@example.com' },
      requestedAt: '2026-08-18T20:00:00.000Z'
    },
    documentTypes: [],
    sellers: [],
    paymentTypes: [],
    costCenters: [],
    warehouses: []
  }
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  currentOrder = baseOrder
  receivedBody = undefined
  contextChecks = 0
  document.body.innerHTML = ''
  clearNuxtData()
})

function findInvoiceButton() {
  return wrapper?.findAll('button').find(button => button.text().trim() === 'Facturar')
}

describe('OrderDetail · facturación', () => {
  it('muestra las etiquetas del pedido únicamente cuando existen', async () => {
    currentOrder = { ...baseOrder, tags: ['urgente', 'mayoreo'] }
    wrapper = await mountSuspended(OrderDetail, {
      props: { orderId: 'order-invoice' },
      global: {
        stubs: {
          UTooltip: { template: '<div><slot /></div>' }
        }
      }
    })

    await vi.waitFor(() => {
      expect(wrapper?.text()).toContain('Etiquetas')
      expect(wrapper?.text()).toContain('urgente')
      expect(wrapper?.text()).toContain('mayoreo')
    })
  })

  it('valida al entrar y marca el pedido sin volver a consultar Siigo al pulsar Facturar', async () => {
    wrapper = await mountSuspended(OrderDetail, {
      props: { orderId: 'order-invoice' },
      global: {
        stubs: {
          UTooltip: { template: '<div><slot /></div>' }
        }
      }
    })

    // El botón queda en estado `loading` mientras se valida el contexto de
    // Siigo, así que hay que esperar a que se habilite antes de pulsarlo.
    await vi.waitFor(() => {
      expect(wrapper?.text()).toContain('Asignar factura anterior')
      expect(contextChecks).toBe(1)
      expect(findInvoiceButton()?.attributes('disabled')).toBeUndefined()
    })
    expect(wrapper.text()).not.toContain('Etiquetas')
    expect(wrapper.text()).not.toContain('Sin facturar')

    const invoiceButton = findInvoiceButton()
    if (!invoiceButton) throw new Error('No se encontró el botón Facturar.')

    await invoiceButton.trigger('click')

    await vi.waitFor(() => {
      expect(receivedBody).toEqual({ version: 1 })
      expect(wrapper?.text()).toContain('Sin facturar')
      expect(contextChecks).toBe(1)
    })
  })

  it('deshabilita Facturar cuando la factura validada ya existe', async () => {
    currentOrder = { ...baseOrder, requiresInvoice: true, invoiceCreated: true }
    wrapper = await mountSuspended(OrderDetail, {
      props: { orderId: 'order-invoice' },
      global: {
        stubs: {
          UTooltip: { template: '<div><slot /></div>' }
        }
      }
    })

    await vi.waitFor(() => expect(contextChecks).toBe(1))
    const invoiceButton = wrapper.findAll('button')
      .find(button => button.text().trim() === 'Facturar')
    expect(invoiceButton?.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).not.toContain('Asignar factura anterior')
  })

  it('permite abrir los pagos para seleccionar una factura existente', async () => {
    currentOrder = {
      ...baseOrder,
      requiresInvoice: true,
      invoiceCreated: false
    }
    wrapper = await mountSuspended(OrderDetail, {
      props: { orderId: 'order-invoice' },
      global: {
        stubs: {
          UTooltip: { template: '<div><slot /></div>' }
        }
      }
    })

    await vi.waitFor(() => {
      expect(wrapper?.text()).toContain('Pagos')
    })

    const paymentsButton = wrapper.findAll('button')
      .find(button => button.text().trim() === 'Pagos')
    expect(paymentsButton?.attributes('disabled')).toBeUndefined()
  })
})
