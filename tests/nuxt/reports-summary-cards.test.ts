// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { expect, it } from 'vitest'
import ReportsSummaryCardsAdapter from '~/components/reports/ReportsSummaryCardsAdapter.vue'
import type { ReportMetrics } from '~/types/reports'

it('conserva las ventas netas y compara las cuatro métricas con el periodo anterior', async () => {
  const metrics = {
    sales: 1200,
    previousSales: 1000,
    salesChangePercentage: 20,
    orderCount: 1,
    averageTicket: 1200,
    materialPurchases: 80,
    previousMaterialPurchases: 100,
    materialPurchasesChangePercentage: -20,
    operatingExpenses: 40,
    previousOperatingExpenses: 0,
    operatingExpensesChangePercentage: null,
    netMarginPercentage: 90,
    previousNetMarginPercentage: 85.5,
    netProfit: 1080
  } as ReportMetrics

  const wrapper = await mountSuspended(ReportsSummaryCardsAdapter, { props: { metrics } })
  try {
    const heading = (index: number) => wrapper.findAll('h3')[index]!.text()
    const comparisons = () => wrapper.findAll('p.mt-3').map(row => row.findAll('span.tabular-nums, span.font-medium, span.text-muted').map(span => span.text()))

    expect(heading(0)).toBe('Ventas netas')
    expect(wrapper.text()).toContain('1 venta · ticket $1,200.00')
    expect(comparisons()).toEqual([
      ['+20%', 'vs. $1,000.00 del mes anterior'],
      ['-20%', 'vs. $100.00 del mes anterior'],
      ['Sin base', 'vs. $0.00 del mes anterior'],
      ['+4.5 pts', 'vs. 85.5% del mes anterior']
    ])
    expect(wrapper.get('p.mt-3 > .text-success').text()).toBe('+20%')
    expect(wrapper.findAll('p.mt-3 > .text-success')[1]!.text()).toBe('-20%')

    await wrapper.setProps({ annual: true })
    expect(comparisons()[0]).toEqual(['+20%', 'vs. $1,000.00 del año anterior'])
  } finally {
    wrapper.unmount()
  }
})
