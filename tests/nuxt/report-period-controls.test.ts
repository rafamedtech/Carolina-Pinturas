// @vitest-environment nuxt
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { getQuery } from 'h3'
import { expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useRouter } from '#app'
import { CalendarMonthPicker } from '#components'
import ReportsPage from '~/pages/reportes.vue'

mockNuxtImport('useAuth', () => () => ({
  disabled: { value: false },
  fetchSession: async () => ({ role: 'admin' })
}))

it('actualiza la consulta y la URL del reporte al cambiar mes, vista y año', async () => {
  const requests: unknown[] = []
  registerEndpoint('/api/reports/summary', (event) => {
    const query = getQuery(event)
    requests.push(query)
    return {
      period: { mode: query.view === 'annual' ? 'annual' : 'monthly', label: query.year ?? query.month },
      metrics: { purchaseInvoiceTotals: [], collectionCoveragePercentage: 0 },
      dailyMovements: [],
      salesChannels: [],
      salesByLine: [],
      topProducts: [],
      topCustomers: [],
      topMaterialProviders: [],
      expenseDetails: [],
      topDebtors: [],
      operatingExpenseCategories: [],
      paymentMethods: []
    }
  })

  let router: ReturnType<typeof useRouter>
  const wrapper = await mountSuspended(defineComponent({
    setup() {
      router = useRouter()
      return () => h(ReportsPage)
    }
  }), {
    route: '/reportes?month=2024-02&ref=dashboard',
    global: {
      stubs: {
        ReportsSummaryCardsAdapter: true,
        ReportsProfitStatement: true,
        ReportsMonthPace: true,
        ReportsCashFlowChart: true,
        ReportsSalesChannels: true
      }
    }
  })

  try {
    const picker = wrapper.getComponent(CalendarMonthPicker)
    const checkPeriod = (query: Record<string, string>, month: string, annual = false) => vi.waitFor(() => {
      expect(requests.at(-1)).toEqual(query)
      expect(router.currentRoute.value.query).toEqual({ month, ref: 'dashboard', ...(annual ? { view: 'annual' } : {}) })
      expect(wrapper.get('#reports-summary').text()).toContain(annual ? 'año' : 'mes')
      expect(wrapper.text()).toContain('Facturas de compras')
    })
    async function select(value: string) {
      await picker.get('button').trigger('click')
      const cell = await vi.waitFor(() => {
        const element = document.querySelector<HTMLElement>(`[data-slot="cellTrigger"][data-value^="${value}"]`)
        expect(element).not.toBeNull()
        return element
      })
      cell?.click()
    }

    await checkPeriod({ month: '2024-02' }, '2024-02')
    expect(picker.props('type')).toBe('month')

    await select('2024-03')
    await checkPeriod({ month: '2024-03' }, '2024-03')

    await wrapper.get('button[aria-label="Cambiar a vista anual"]').trigger('click')
    await checkPeriod({ view: 'annual', year: '2024' }, '2024-03', true)
    expect(picker.props('type')).toBe('year')

    await select('2023')
    await checkPeriod({ view: 'annual', year: '2023' }, '2023-03', true)

    await wrapper.get('button[aria-label="Cambiar a vista mensual"]').trigger('click')
    await checkPeriod({ month: '2023-03' }, '2023-03')
  } finally {
    wrapper.unmount()
  }
})
