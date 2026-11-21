// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { expect, it, vi } from 'vitest'
import { h } from 'vue'
import { AppButton, ReportsSectionHeading } from '#components'

it('mantiene el nombre accesible y la jerarquía del encabezado de Pinturas', async () => {
  const wrapper = await mountSuspended({
    render: () => h('section', { 'aria-labelledby': 'reports-sales' }, [
      h(ReportsSectionHeading, {
        id: 'reports-sales',
        title: 'Ventas',
        marker: 'bg-primary',
        amount: 0,
        ui: { root: 'flex-nowrap', title: 'text-base tracking-tight' }
      })
    ])
  })

  const heading = wrapper.get('section[aria-labelledby="reports-sales"] h2#reports-sales')
  expect(heading.text()).toBe('Ventas')
  expect(heading.element.parentElement?.classList.contains('text-base')).toBe(true)
  expect(heading.get('span.bg-primary').attributes('aria-hidden')).toBe('true')
  expect(wrapper.get('.flex-nowrap').classes()).toContain('items-baseline')
  expect(wrapper.get('p.tabular-nums').text()).toBe('$0.00')
  wrapper.unmount()
})

it('mantiene las acciones de CVR y sustituye el importe durante la carga', async () => {
  const onClick = vi.fn()
  const wrapper = await mountSuspended(ReportsSectionHeading, {
    props: { id: 'order-overview', title: 'Detalle de la orden', marker: 'bg-primary', amount: -42.5, loading: true },
    slots: { actions: () => h(AppButton, { label: 'Gastos', onClick }) }
  })

  expect(wrapper.get('h2#order-overview').element.parentElement?.classList.contains('text-xl')).toBe(true)
  expect(wrapper.classes()).toEqual(expect.arrayContaining(['flex-wrap', 'items-center']))
  expect(wrapper.get('[aria-busy="true"]').classes()).toEqual(expect.arrayContaining(['h-5', 'w-24']))
  expect(wrapper.find('p.tabular-nums').exists()).toBe(false)
  const action = wrapper.get('button')
  expect(action.text()).toBe('Gastos')
  expect(action.element.parentElement?.classList.contains('sm:w-auto')).toBe(true)
  await action.trigger('click')
  expect(onClick).toHaveBeenCalledOnce()

  await wrapper.setProps({ loading: false })
  expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false)
  expect(wrapper.get('p.tabular-nums').text()).toBe('-$42.50')
  await wrapper.setProps({ amount: undefined })
  expect(wrapper.find('p.tabular-nums').exists()).toBe(false)
  wrapper.unmount()
})
