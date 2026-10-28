// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import OrderDetail from '~/components/orders/OrderDetail.vue'
import OrderDetailItems from '~/components/orders/OrderDetailItems.vue'
import OrderStatusPanel from '~/components/orders/OrderStatusPanel.vue'
import type { UserRole } from '~/types/siigo'
import type { SalesOrderDetail } from '~/types/orders'

const { useAuthMock, authRole } = vi.hoisted(() => {
  const authRole = { value: 'admin' as UserRole }
  return {
    authRole,
    useAuthMock: vi.fn(() => {
      const user = {
        id: 'admin-1',
        name: 'Administrador',
        email: 'admin@example.com',
        role: authRole.value,
        repartidorId: null
      }
      return {
        user: { value: user },
        disabled: { value: false },
        fetchSession: vi.fn(async () => user)
      }
    })
  }
})

mockNuxtImport('useAuth', () => useAuthMock)

const baseOrder = {
  id: 'order-invoice',
  folio: 12,
  number: 'PED-000012',
  status: { key: 'confirmado', label: 'Confirmado', color: 'success', sortOrder: 80, isTerminal: false },
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
let wrapper: VueWrapper | null = null
registerEndpoint('/api/orders/order-invoice', () => currentOrder)
registerEndpoint('/api/orders/statuses', () => [baseOrder.status])
registerEndpoint('/api/repartidores', () => [])

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  currentOrder = baseOrder
  authRole.value = 'admin'
  document.body.innerHTML = ''
  clearNuxtData()
})

describe('OrderDetail · permisos para eliminar partidas', () => {
  it.each([
    ['admin', false, 'confirmado', true],
    ['admin', false, 'surtido', true],
    ['admin', false, 'en_camino', false],
    ['admin', false, 'entregado', false],
    ['admin', true, 'confirmado', false],
    ['mostrador', false, 'confirmado', false],
    ['vendedor', false, 'confirmado', false]
  ] as const)('permiso para %s con facturado=%s y estado=%s es %s', async (role, invoiceCreated, statusKey, deletable) => {
    authRole.value = role
    currentOrder = { ...baseOrder, invoiceCreated, status: { ...baseOrder.status, key: statusKey } }
    wrapper = await mountSuspended(OrderDetail, {
      props: { orderId: 'order-invoice' },
      global: { stubs: { OrdersSiigoOrderSiigoInvoiceCard: true } }
    })
    await vi.waitFor(() => expect(wrapper?.findComponent(OrderDetailItems).exists()).toBe(true))
    expect(wrapper.findComponent(OrderDetailItems).props('deletable')).toBe(deletable)
  })
})

describe('OrderDetail · estado después de la entrega', () => {
  it.each([
    ['admin', 'entregado', false],
    ['mostrador', 'entregado', true],
    ['vendedor', 'entregado', true],
    ['repartidor', 'entregado', true],
    ['igualaciones', 'entregado', true],
    ['mostrador', 'en_camino', false],
    ['repartidor', 'en_camino', false]
  ] as const)('selector para %s en %s: deshabilitado=%s', async (role, statusKey, disabled) => {
    authRole.value = role
    currentOrder = { ...baseOrder, status: { ...baseOrder.status, key: statusKey } }
    wrapper = await mountSuspended(OrderDetail, {
      props: { orderId: 'order-invoice' },
      global: { stubs: { OrdersSiigoOrderSiigoInvoiceCard: true } }
    })
    await vi.waitFor(() => expect(wrapper?.findComponent(OrderStatusPanel).exists()).toBe(true))
    const panel = wrapper.findComponent(OrderStatusPanel)
    expect(panel.props('editable')).toBe(true)
    expect(panel.props('disabled')).toBe(disabled)
    expect(panel.find('[role="combobox"]').attributes('disabled') !== undefined).toBe(disabled)
  })
})

describe('OrderDetail · edición después de la entrega', () => {
  it.each([
    ['admin', 'entregado', false],
    ['mostrador', 'entregado', true],
    ['vendedor', 'entregado', true],
    ['repartidor', 'entregado', true],
    ['mostrador', 'confirmado', false]
  ] as const)('editar para %s en %s: deshabilitado=%s', async (role, statusKey, disabled) => {
    authRole.value = role
    currentOrder = { ...baseOrder, status: { ...baseOrder.status, key: statusKey } }
    wrapper = await mountSuspended(OrderDetail, {
      props: { orderId: 'order-invoice' },
      global: { stubs: { OrdersSiigoOrderSiigoInvoiceCard: true } }
    })
    await vi.waitFor(() => expect(wrapper?.findComponent(OrderDetailItems).exists()).toBe(true))
    const actions = wrapper.findAllComponents({ name: 'UDropdownMenu' })
      .flatMap(menu => menu.props('items').flat())
    const edit = actions.find(action => action.label === 'Editar pedido')
    expect(edit).toMatchObject({ disabled, to: { path: '/ventas/order-invoice/editar' } })
  })
})
