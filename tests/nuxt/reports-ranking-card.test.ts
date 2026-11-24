// @vitest-environment nuxt
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { expect, it } from 'vitest'
import { ref } from 'vue'
import { ReportsRankingCard } from '#components'
import ReportsDashboard from '~/components/reports/ReportsDashboard.vue'

const products = [
  { id: 'low', label: 'Sellador', detail: 'S-01', amount: 15, count: 1, percentage: 10 },
  { id: 'z-high', label: 'Rodillo', detail: 'R-01', amount: 1_250, count: 2, percentage: 45 },
  { id: 'a-high', label: 'Brocha', detail: 'B-01', amount: 1_250, count: 3, percentage: 45 }
]

mockNuxtImport('useBusinessReports', () => () => ({
  data: ref({
    period: { mode: 'monthly', label: 'Noviembre de 2026' },
    metrics: { outstandingBalance: 1250, collections: 500, netCashFlow: 400, collectionCoveragePercentage: 40 },
    dailyMovements: [],
    salesChannels: [],
    salesByLine: [],
    topProducts: products,
    topCustomers: [],
    topMaterialProviders: [
      { id: 'provider', label: 'Proveedor', detail: 'Material', amount: 1_250, count: 1, percentage: 100 }
    ],
    expenseDetails: [],
    topDebtors: [
      { id: 'debtor', label: 'Cliente', detail: 'Ejemplo', amount: 1_250, count: 1, percentage: 100 }
    ],
    operatingExpenseCategories: [],
    paymentMethods: []
  }),
  status: ref('success'),
  error: ref(null)
}))

it('muestra los rankings de Pinturas en el orden recibido y conserva sus variantes', async () => {
  const wrapper = await mountSuspended(ReportsDashboard, {
    props: { month: '2026-11', view: 'monthly' },
    global: {
      stubs: {
        ReportsSummaryCardsAdapter: true,
        ReportsProfitStatement: true,
        ReportsMonthPace: true,
        ReportsCashFlowChart: true,
        ReportsSectionHeading: true,
        ReportsSalesChannels: true,
        ReportsPurchaseInvoices: true,
        ReportsExpenseDetails: true
      }
    }
  })

  try {
    const [products, customers, providers, debtors] = wrapper.findAllComponents(ReportsRankingCard)
    expect(products!.get('h2').element.parentElement?.classList.contains('text-base')).toBe(true)
    expect(products!.findAll('ol > li').map(row => [
      row.get('span').text(),
      ...row.findAll('p').map(value => value.text())
    ])).toEqual([
      ['1', 'Sellador', '$15', 'S-01 · 1 uds. · 10%'],
      ['2', 'Rodillo', '$1.3 k', 'R-01 · 2 uds. · 45%'],
      ['3', 'Brocha', '$1.3 k', 'B-01 · 3 uds. · 45%']
    ])
    expect(customers!.text()).toContain('Sin clientes con ventas')
    expect(customers!.find('ol').exists()).toBe(false)
    expect(providers!.get('li').text()).toContain('$1,250.00')
    expect(providers!.get('.bg-violet-500').attributes('style')).toContain('width: 100%')
    expect(debtors!.text()).toContain('Pendiente')
    expect(debtors!.text()).toContain('Clientes con mayor adeudo')
  } finally {
    wrapper.unmount()
  }
})

it('conserva la configuración de CVR al recibir un nuevo orden', async () => {
  const wrapper = await mountSuspended(ReportsRankingCard, {
    props: {
      title: 'Trabajos destacados',
      description: 'Conceptos con mayor venta en el periodo.',
      icon: 'i-lucide-clipboard-list',
      empty: 'Sin trabajos registrados',
      items: products,
      countLabel: count => `${count} órdenes`,
      uppercaseValues: true
    }
  })

  try {
    expect(wrapper.get('h2').element.parentElement?.classList.contains('text-lg')).toBe(true)
    expect(wrapper.get('li p.uppercase').text()).toBe('Sellador')
    await wrapper.setProps({ items: [...products].reverse() })
    expect(wrapper.findAll('li').map(row => [row.get('span').text(), row.get('p').text()])).toEqual([
      ['1', 'Brocha'],
      ['2', 'Rodillo'],
      ['3', 'Sellador']
    ])
  } finally {
    wrapper.unmount()
  }
})
