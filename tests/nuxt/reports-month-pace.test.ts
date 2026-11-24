// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { expect, it } from 'vitest'
import { ReportsMonthPace } from '#components'

it('muestra el avance y actualiza los importes al cambiar de periodo', async () => {
  const wrapper = await mountSuspended(ReportsMonthPace, {
    props: {
      period: { mode: 'monthly', elapsedDays: 15, totalDays: 30 },
      metrics: { sales: 1500, previousSales: 2480, previousDays: 31 },
      ui: { title: 'text-base' }
    }
  })

  try {
    const progress = () => wrapper.get('[role="progressbar"]')
    expect(wrapper.get('h2').text()).toBe('Proyección de cierre')
    expect(progress().attributes('aria-valuenow')).toBe('50')
    expect(wrapper.text()).toContain('$3,000.00')
    expect(wrapper.text()).toContain('+25%')
    expect(wrapper.text()).toContain('Mes anterior / día')

    await wrapper.setProps({ period: { mode: 'annual', elapsedDays: 366, totalDays: 366 } })
    expect(wrapper.get('h2').text()).toBe('Cierre del año')
    expect(progress().attributes('aria-valuenow')).toBe('100')
    expect(wrapper.text()).toContain('$1,500.00')
    expect(wrapper.text()).toContain('Año anterior / día')
    expect(wrapper.text()).not.toContain('Estimación lineal')

    await wrapper.setProps({
      period: { mode: 'monthly', elapsedDays: 0, totalDays: 31 },
      metrics: { sales: 0, previousSales: 0, previousDays: 30 }
    })
    expect(wrapper.get('h2').text()).toBe('Periodo sin iniciar')
    expect(progress().attributes('aria-valuenow')).toBe('0')
    expect(wrapper.text()).toContain('$0.00')
    expect(wrapper.text()).toContain('Sin base')
  } finally {
    wrapper.unmount()
  }
})
