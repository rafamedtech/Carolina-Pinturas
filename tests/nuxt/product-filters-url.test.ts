// @vitest-environment nuxt
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import ProductFilters from '~/components/products/ProductFilters.vue'
import OrderDatePicker from '~/components/orders/OrderDatePicker.vue'

let wrapper: VueWrapper | undefined
afterEach(() => wrapper?.unmount())

describe('product filters restored from the URL', () => {
  it('shows the saved state and all four dates, and updates when navigating back', async () => {
    const filters = { active: 'all', created_start: '2026-09-01', created_end: '2026-09-30', updated_start: '2026-10-01', updated_end: '2026-10-13' }
    wrapper = await mountSuspended(ProductFilters, { props: { filters } })
    const dates = () => wrapper!.findAllComponents(OrderDatePicker).map(picker => picker.props('modelValue')?.toString())
    expect(dates()).toEqual(['2026-09-01', '2026-09-30', '2026-10-01', '2026-10-13'])
    await wrapper.findAll('button').find(button => button.text() === 'Aplicar filtros')!.trigger('click')
    expect(wrapper.emitted('change')?.[0]?.[0]).toEqual(filters)
    await wrapper.setProps({ filters: { active: 'false', created_start: '2026-08-01' } })
    expect(dates()).toEqual(['2026-08-01', undefined, undefined, undefined])
    await wrapper.findAll('button').find(button => button.text() === 'Aplicar filtros')!.trigger('click')
    expect(wrapper.emitted('change')?.[1]?.[0]).toEqual({ active: 'false', created_start: '2026-08-01' })
  })

  it('clears restored dates and returns to the default state', async () => {
    wrapper = await mountSuspended(ProductFilters, { props: { filters: { active: 'false', created_start: '2026-09-01' } } })
    await wrapper.findAll('button').find(button => button.text() === 'Limpiar filtros')!.trigger('click')
    expect(wrapper.emitted('change')?.[0]?.[0]).toEqual({ active: 'true' })
  })
})
