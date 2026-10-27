// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineEventHandler, readBody } from 'h3'
import type { VueWrapper } from '@vue/test-utils'
import { UButton, UDropdownMenu } from '#components'
import type { UserRole } from '~/types/siigo'
import type { DropdownMenuItem } from '@nuxt/ui'
import OrderDetail from '~/components/orders/OrderDetail.vue'
import type { SalesOrderDetail } from '~/types/orders'

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(() => {
    const user = {
      id: 'admin-1',
      name: 'Administrador',
      email: 'admin@example.com',
      role: 'admin' as UserRole,
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
  vi.useRealTimers()
})

function findInvoiceButton() {
  return wrapper?.findAll('button').find(button => button.text().trim() === 'Facturar')
}

function dropdownMenus(): VueWrapper[] {
  // Vue Test Utils infiere DOMWrapper para este componente genérico de Nuxt UI.
  return wrapper?.findAllComponents(UDropdownMenu) as unknown as VueWrapper[] ?? []
}

function menuItems(menu?: VueWrapper): DropdownMenuItem[] {
  return (menu?.props() as { items?: DropdownMenuItem[][] } | undefined)?.items?.flat() ?? []
}

describe('OrderDetail · facturación', () => {
  it('agrupa asignar factura e impresora en Admin y las retira de Opciones', async () => {
    wrapper = await mountSuspended(OrderDetail, { props: { orderId: 'order-invoice' } })
    await vi.waitFor(() => expect(wrapper?.text()).toContain('Admin'))
    const menus = dropdownMenus()
    const admin = menus.find(menu => menu.findAllComponents(UButton).some(button => button.props('label') === 'Admin'))
    const options = menus.find(menu => menu.findAllComponents(UButton).some(button => button.props('label') === 'Opciones'))
    const adminItems = menuItems(admin)
    expect(adminItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Asignar factura', icon: 'i-lucide-link' }),
      expect.objectContaining({ label: 'Impresora de tickets…', icon: 'i-lucide-printer' })
    ]))
    expect(menuItems(options)).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Impresora de tickets…' })
    ]))
    expect(wrapper.findAllComponents(UButton).some(button => button.props('label') === 'Asignar factura')).toBe(false)
  })

  it.each(['mostrador', 'vendedor', 'repartidor', 'igualaciones'] as UserRole[])('oculta Admin para el rol %s', async (role) => {
    const session = useAuthMock()
    session.user.value.role = role
    useAuthMock.mockReturnValueOnce(session)
    wrapper = await mountSuspended(OrderDetail, { props: { orderId: 'order-invoice' } })
    await vi.waitFor(() => expect(wrapper?.text()).toContain(baseOrder.number))
    expect(wrapper.findAllComponents(UButton).some(button => button.props('label') === 'Admin')).toBe(false)
    expect(dropdownMenus().flatMap(menuItems)).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Asignar factura' }),
      expect.objectContaining({ label: 'Impresora de tickets…' })
    ]))
  })

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

  it('conserva Facturar sin mostrar badges de facturación y sin volver a consultar Siigo al pulsarlo', async () => {
    currentOrder = { ...baseOrder, requiresInvoice: true }
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
      expect(wrapper?.text()).toContain('Admin')
      expect(contextChecks).toBe(1)
      expect(findInvoiceButton()?.attributes('disabled')).toBeUndefined()
    })
    expect(wrapper.text()).not.toContain('Etiquetas')
    expect(wrapper.text()).not.toContain('Sin facturar')

    const invoiceButton = findInvoiceButton()
    if (!invoiceButton) throw new Error('No se encontró el botón Facturar.')

    await invoiceButton.trigger('click')

    await vi.waitFor(() => {
      expect(receivedBody).toBeUndefined()
      expect(wrapper?.text()).not.toContain('Sin facturar')
      expect(contextChecks).toBe(1)
    })
  })

  it('muestra Facturado en verde con check cuando la factura ya existe', async () => {
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
      .find(button => button.text().trim() === 'Facturado')
    expect(invoiceButton).toBeDefined()
    expect(invoiceButton?.attributes('disabled')).toBeDefined()
    expect(invoiceButton?.classes().join(' ')).toContain('bg-success')
    expect(wrapper.findAllComponents(UButton).find(button => button.props('label') === 'Facturado')?.props('icon')).toBe('i-lucide-check')
    expect(wrapper.text()).not.toContain('Sin facturar')
    expect(wrapper.findAllComponents({ name: 'UBadge' }).some(badge => badge.text() === 'Facturado')).toBe(false)
    expect(wrapper.text()).toContain('Admin')
  })

  it.each([
    { status: 'pendiente_pago', label: 'Pago pendiente', color: 'warning' },
    { status: 'abonado', label: 'Abonado', color: 'info' },
    { status: 'pago_recibido', label: 'Pago recibido', color: 'success' }
  ] as const)('muestra $label con color $color en el botón de pagos sin badge duplicado', async ({ status, label, color }) => {
    vi.setSystemTime(new Date('2026-08-25T18:00:00Z'))
    currentOrder = {
      ...baseOrder,
      paymentStatus: status,
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
      expect(wrapper?.text()).toContain(label)
    })

    const paymentsButton = wrapper.findAll('button')
      .find(button => button.text().trim() === label)
    expect(paymentsButton).toBeDefined()
    expect(paymentsButton?.attributes('disabled')).toBeUndefined()
    expect(wrapper.findAllComponents(UButton).find(button => button.props('label') === label)?.props('color')).toBe(color)
    expect(wrapper.findAllComponents({ name: 'UBadge' }).some(badge => ['Pendiente de pago', 'Abonado', 'Pago recibido'].includes(badge.text()))).toBe(false)
    await paymentsButton?.trigger('click')
    await vi.waitFor(() => expect(document.body.textContent).toContain(`Pagos · ${baseOrder.number}`))
  })

  it.each([
    { status: 'pendiente_pago', date: '2026-08-20', color: 'warning' },
    { status: 'abonado', date: '2026-08-20', color: 'info' },
    { status: 'pendiente_pago', date: '2026-08-19', color: 'warning' },
    { status: 'abonado', date: '2026-08-19', color: 'info' },
    { status: 'pendiente_pago', date: '2026-08-18', color: 'error' },
    { status: 'abonado', date: '2026-08-18', color: 'error' },
    { status: 'pago_recibido', date: '2026-08-18', color: 'success' }
  ] as const)('usa $color para $status con fecha $date al superar siete días de calendario', async ({ status, date, color }) => {
    // En UTC ya es 27; en México sigue siendo el día 26.
    vi.setSystemTime(new Date('2026-08-27T02:00:00Z'))
    currentOrder = { ...baseOrder, orderDate: date, paymentStatus: status }
    wrapper = await mountSuspended(OrderDetail, { props: { orderId: 'order-invoice' } })
    await vi.waitFor(() => expect(wrapper?.text()).toContain(baseOrder.number))
    const button = wrapper.findAllComponents(UButton).find(button => button.props('icon') === 'i-lucide-hand-coins')
    expect(button?.props('color')).toBe(color)
  })
})
