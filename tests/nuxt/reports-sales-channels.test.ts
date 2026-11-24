// @vitest-environment nuxt
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { expect, it } from 'vitest'
import { ref } from 'vue'
import { ReportsSalesChannels } from '#components'
import ReportsDashboard from '~/components/reports/ReportsDashboard.vue'

const channels = [
  { key: 'counter', label: 'Mostrador', amount: 700, count: 2, percentage: 70 },
  { key: 'seller', label: 'Vendedor', amount: 300, count: 1, percentage: 30 },
  { key: 'internal', label: 'Clientes internos', amount: 0, count: 0, percentage: 0 }
]

mockNuxtImport('useBusinessReports', () => () => ({
  data: ref({
    period: { mode: 'monthly', label: 'Noviembre de 2026' },
    metrics: {
      sales: 1000,
      materialPurchases: 0,
      operatingExpenses: 0,
      collections: 0,
      previousCounterSales: 350,
      previousSellerSales: 400,
      previousInternalSales: 125
    },
    salesChannels: channels,
    dailyMovements: [],
    salesByLine: [],
    topProducts: [],
    topCustomers: [],
    topMaterialProviders: [],
    operatingExpenseCategories: [],
    topDebtors: [],
    paymentMethods: []
  }),
  status: ref('success'),
  error: ref(null)
}))

it('uses the three Pinturas channels and their previous amounts in the dashboard', async () => {
  const wrapper = await mountSuspended(ReportsDashboard, {
    props: { month: '2026-11', view: 'monthly' },
    global: {
      stubs: {
        ReportsSummaryCardsAdapter: true,
        ReportsProfitStatement: true,
        ReportsMonthPace: true,
        ReportsCashFlowChart: true,
        ReportsBreakdownCard: true,
        ReportsRankingCard: true,
        ReportsPurchaseInvoices: true,
        ReportsExpenseDetails: true
      }
    }
  })

  try {
    const card = wrapper.getComponent(ReportsSalesChannels)
    expect(card.findAll('dt').map(label => label.text())).toEqual(['Mostrador 70%', 'Vendedor 30%', 'Clientes internos 0%'])
    expect(card.findAll('dd > p:first-child').map(value => value.text())).toEqual(['$700.00', '$300.00', '$0.00'])
    expect(card.findAll('dd > p:last-child').map(value => value.text().replace(/Anterior|\s+/g, part => part === 'Anterior' ? '' : ' '))).toEqual([
      '2 ventas · ant. $350.00 (+100%)',
      '1 venta · ant. $400.00 (-25%)',
      '0 ventas · ant. $125.00 (-100%)'
    ])
    expect(card.get('dd .sr-only').text()).toBe('Anterior')
    expect(card.findAll('svg g path').map(path => path.classes().filter(name => name.startsWith('fill-')))).toEqual([
      ['fill-primary'], ['fill-success']
    ])
    expect(card.get('svg[viewBox="0 0 200 200"]').attributes('aria-hidden')).toBe('true')
  } finally {
    wrapper.unmount()
  }
})

it('renders a compact workshop donut, then keeps a readable legend at zero', async () => {
  const workshop = { key: 'workshop', label: 'Talleres', amount: 100, count: 1, percentage: 100, previousAmount: 0 }
  const wrapper = await mountSuspended(ReportsSalesChannels, {
    props: { channels: [workshop], title: 'Talleres', compact: true }
  })

  try {
    expect(wrapper.get('svg.size-36 g circle').classes()).toContain('fill-violet-500')
    expect(wrapper.get('dl').classes()).toContain('grid-cols-1')
    expect(wrapper.get('dt').text()).toBe('Talleres 100%')
    expect(wrapper.get('dd').text()).not.toContain('Sin base')

    await wrapper.setProps({ channels: [{ ...workshop, amount: 0, count: 0, percentage: 0, previousAmount: 100 }] })
    expect(wrapper.get('svg g circle').classes()).toContain('fill-elevated')
    expect(wrapper.get('dt').text()).toBe('Talleres 0%')
    expect(wrapper.get('dd').text()).toContain('(-100%)')
    expect(wrapper.text()).toContain('Sin ventas en este periodo.')
  } finally {
    wrapper.unmount()
  }
})
