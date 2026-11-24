// @vitest-environment nuxt
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { expect, it } from 'vitest'
import { ref } from 'vue'
import { ReportsBreakdownCard } from '#components'
import ReportsDashboard from '~/components/reports/ReportsDashboard.vue'

const items = Array.from({ length: 9 }, (_, index) => ({
  key: String(index),
  label: `Categoría ${index + 1}`,
  amount: 1_250,
  count: index + 1,
  percentage: 11.1
}))

mockNuxtImport('useBusinessReports', () => () => ({
  data: ref({
    period: { mode: 'monthly', label: 'Noviembre de 2026' },
    metrics: { purchaseInvoiceTotals: [] },
    dailyMovements: [],
    salesChannels: [],
    salesByLine: [],
    topProducts: [],
    topCustomers: [],
    topMaterialProviders: [],
    expenseDetails: [],
    topDebtors: [],
    operatingExpenseCategories: items,
    paymentMethods: []
  }),
  status: ref('success'),
  error: ref(null)
}))

it('conserva importes, porcentajes y conteos al expandir y volver a colapsar el desglose de gastos', async () => {
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
        ReportsRankingCard: true,
        ReportsPurchaseInvoices: true,
        ReportsExpenseDetails: true
      }
    }
  })

  try {
    const card = wrapper.findAllComponents(ReportsBreakdownCard)
      .find(card => card.props('title') === 'Gastos operativos por categoría')!
    const rows = () => card.findAll('li').map(row => row.findAll('p, div.text-muted > span').map(value => value.text()))
    const toggle = () => card.get('button[aria-expanded]')
    const expectedRows = items.map((item, index) => [
      item.label,
      '$1.3 k',
      index === 0 ? '1 gasto' : `${index + 1} gastos`,
      '11.1%'
    ])

    expect(card.get('h2').text()).toBe('Gastos operativos por categoría')
    expect(card.get('h2').element.parentElement?.classList.value.split(' ')).toContain('text-base')
    expect(card.get('ul').attributes('id')).toBe(toggle().attributes('aria-controls'))
    expect(card.find('reports-expense-details-stub').exists()).toBe(true)
    expect(wrapper.text()).toContain('Sin ventas')

    expect(rows()).toEqual(expectedRows.slice(0, 8))
    expect(toggle().text()).toBe('Ver 1 más')
    await toggle().trigger('click')
    expect(rows()).toEqual(expectedRows)
    expect(toggle().attributes('aria-expanded')).toBe('true')

    await toggle().trigger('click')
    expect(rows()).toEqual(expectedRows.slice(0, 8))
    expect(toggle().attributes('aria-expanded')).toBe('false')
  } finally {
    wrapper.unmount()
  }
})
