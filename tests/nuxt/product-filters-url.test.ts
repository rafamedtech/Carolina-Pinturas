// @vitest-environment nuxt
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import type { ListFilterDefinition } from '~/types/list'
import ListFilterFields from '~/components/list/ListFilterFields.vue'
import OrderDatePicker from '~/components/orders/OrderDatePicker.vue'

const keys = ['created_start', 'created_end', 'updated_start', 'updated_end']
const fields: ListFilterDefinition[] = keys.map(key => ({ key, label: key, type: 'date', defaultValue: '' }))
let wrapper: VueWrapper | undefined
afterEach(() => wrapper?.unmount())

describe('fechas de filtros restauradas de la URL', () => {
  it('reutiliza cuatro calendarios y conserva sus días al restaurar y navegar atrás', async () => {
    wrapper = await mountSuspended(ListFilterFields, { props: { fields, modelValue: { created_start: '2026-09-01', created_end: '2026-09-30', updated_start: '2026-10-01', updated_end: '2026-10-13' } } })
    const dates = () => wrapper!.findAllComponents(OrderDatePicker).map(picker => picker.props('modelValue')?.toString())
    expect(dates()).toEqual(['2026-09-01', '2026-09-30', '2026-10-01', '2026-10-13'])
    expect(wrapper.text()).toContain('01/09/2026')
    await wrapper.setProps({ modelValue: { created_start: '2026-08-01' } })
    expect(dates()).toEqual(['2026-08-01', undefined, undefined, undefined])
    await wrapper.setProps({ modelValue: {} })
    expect(dates()).toEqual([undefined, undefined, undefined, undefined])
  })
})
