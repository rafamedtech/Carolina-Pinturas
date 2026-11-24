// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { expect, it } from 'vitest'
import { ReportsCashFlowChart } from '#components'
import type { ReportDailyMovement } from '~/types/reports'

function movement(date: string, sales: number, materialPurchases: number, operatingExpenses: number): ReportDailyMovement {
  return {
    date,
    label: date,
    sales,
    materialPurchases,
    operatingExpenses,
    netProfit: sales - materialPurchases - operatingExpenses,
    orderCount: 0,
    counterSales: 0,
    sellerSales: 0,
    internalSales: 0,
    collections: 0,
    expenses: materialPurchases + operatingExpenses,
    netCashFlow: 0
  }
}

it('conserva la escala, la interacción y el desplazamiento de la gráfica semanal y mensual', async () => {
  const wrapper = await mountSuspended(ReportsCashFlowChart, {
    props: {
      data: [
        movement('2026-11-02', 100, 30, 10),
        movement('2026-11-03', 100, 70, 40),
        movement('2026-11-09', 50, 400, 0)
      ]
    }
  })

  try {
    const periods = wrapper.findAll('[role="img"][tabindex="0"]')
    expect(wrapper.get('h2').text()).toBe('Venta y costo por semana')
    expect(periods).toHaveLength(2)
    expect(wrapper.text()).toContain('$250')
    expect(wrapper.get('.overflow-x-auto .grid').attributes('style')).toContain('repeat(2, minmax(128px, 1fr))')
    expect(wrapper.get('polyline').attributes('points')).toBe('250,128 750,224')
    expect(periods[1]!.findAll<HTMLElement>('.items-end > div').map(bar => bar.element.style.height)).toEqual(['12.5%', '100%', '0%'])

    await periods[0]!.trigger('focus')
    expect(periods[0]!.attributes('aria-label')).toContain('ventas $200, compras de material $100, gastos operativos $50')
    expect(wrapper.text()).toContain('$200')
    expect(wrapper.text()).not.toContain('Totales de lunes a domingo')
    await periods[0]!.trigger('blur')
    await periods[1]!.trigger('mouseenter')
    expect(wrapper.text()).toContain('-$350')
    await wrapper.get('.overflow-x-auto').trigger('mouseleave')
    expect(wrapper.text()).toContain('Totales de lunes a domingo')

    await wrapper.setProps({ annual: true })
    expect(wrapper.get('h2').text()).toBe('Venta y costo por mes')
    expect(wrapper.findAll('[role="img"][tabindex="0"]')).toHaveLength(1)
    expect(wrapper.get('.overflow-x-auto .grid').attributes('style')).toContain('repeat(1, minmax(80px, 1fr))')
    expect(wrapper.find('polyline').exists()).toBe(false)

    await wrapper.setProps({ data: [] })
    expect(wrapper.text()).toContain('Sin movimientos en este periodo')
    expect(wrapper.find('.overflow-x-auto').exists()).toBe(false)
  } finally {
    wrapper.unmount()
  }
})
