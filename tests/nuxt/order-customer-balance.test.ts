// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import OrderCustomerBalance from '~/components/orders/OrderCustomerBalance.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  vi.unstubAllGlobals()
})

const summary = (status: 'current' | 'recent' | 'overdue') => ({
  status, customerId: 'client', balance: status === 'current' ? 0 : 100,
  pendingOrders: status === 'current' ? 0 : 1, recentUnpaidOrders: 0, overdueOrders: status === 'overdue' ? 1 : 0
})

describe('indicador de saldo del cliente', () => {
  it.each([
    ['current', 'Cliente al corriente', 'text-success'],
    ['recent', 'Cliente con pedidos recientes', 'text-warning'],
    ['overdue', 'Cliente con saldo vencido', 'text-error']
  ] as const)('muestra el texto y color del estado %s', async (status, label, color) => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(summary(status)))
    wrapper = await mountSuspended(OrderCustomerBalance, { props: { customerId: 'client' } })
    await vi.waitFor(() => expect(wrapper!.text()).toContain(label))
    expect(wrapper.find('[title]').classes()).toContain(color)
    expect(wrapper.find('[title]').attributes('title')).toContain('Pedidos con saldo:')
  })

  it('descarta respuestas tardías al cambiar de cliente', async () => {
    let resolveFirst!: (value: ReturnType<typeof summary>) => void
    const first = new Promise<ReturnType<typeof summary>>((resolve) => {
      resolveFirst = resolve
    })
    vi.stubGlobal('$fetch', vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce(summary('overdue')))
    wrapper = await mountSuspended(OrderCustomerBalance, { props: { customerId: 'first' } })
    await wrapper.setProps({ customerId: 'second' })
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Cliente con saldo vencido'))
    resolveFirst(summary('current'))
    await nextTick()
    expect(wrapper.text()).toContain('Cliente con saldo vencido')
    expect(wrapper.text()).not.toContain('Cliente al corriente')
  })

  it('no presenta al cliente como al corriente cuando falla la consulta', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('Sin conexión')))
    wrapper = await mountSuspended(OrderCustomerBalance, { props: { customerId: 'client' } })
    await vi.waitFor(() => expect(wrapper!.text()).toContain('No se pudo consultar el saldo'))
    expect(wrapper.text()).not.toContain('Cliente al corriente')
  })
})
