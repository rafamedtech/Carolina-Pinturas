// @vitest-environment nuxt
import { expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ReportsProfitStatement from '~/components/reports/ReportsProfitStatement.vue'
import type { ReportMetrics } from '~/types/reports'

it('muestra una reducción de compras como favorable y una subida de gastos como desfavorable', async () => {
  const metrics = {
    sales: 300,
    previousSales: 0,
    materialPurchases: 80,
    previousMaterialPurchases: 120,
    grossProfit: 220,
    previousGrossProfit: -120,
    grossMarginPercentage: 73.3,
    operatingExpenses: 20,
    previousOperatingExpenses: 10,
    netProfit: 200,
    previousNetProfit: -130
  } as ReportMetrics

  const wrapper = await mountSuspended(ReportsProfitStatement, { props: { metrics } })
  try {
    const rows = wrapper.findAll('tbody tr')
    const materials = rows.find(row => row.text().includes('Compras de material'))!
    const operating = rows.find(row => row.text().includes('Gastos operativos'))!
    const sales = rows.find(row => row.text().includes('Ventas netas'))!

    expect(materials.get('td:last-child .text-success').text()).toBe('-33.3%')
    expect(operating.get('td:last-child .text-error').text()).toBe('+100%')
    expect(sales.get('td:last-child .text-muted').text()).toBe('Sin base')
  } finally {
    wrapper.unmount()
  }
})
