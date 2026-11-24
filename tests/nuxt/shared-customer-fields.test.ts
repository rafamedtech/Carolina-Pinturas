// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { AppPhoneInput, SiigoMexicoLocationFields } from '#components'

describe('Campos de cliente de Nuxt Shared', () => {
  it('conserva el teléfono nacional visible y emite solo dígitos', async () => {
    const wrapper = await mountSuspended(AppPhoneInput, { props: { modelValue: '6641234567' } })
    try {
      const input = wrapper.get('input')
      expect(input.element.value).toBe('(664) 123-4567')
      await input.setValue('664a123-4568')
      expect(input.element.value).toBe('(664) 123-4568')
      expect(wrapper.emitted('update:modelValue')).toEqual([['6641234568']])

      await wrapper.setProps({ modelValue: '664' })
      expect(input.element.value).toBe('(664)')
      await input.setValue('(664')
      expect(input.element.value).toBe('(664')
      await input.setValue('(66')
      expect(wrapper.emitted('update:modelValue')).toEqual([['6641234568'], ['66']])
    } finally {
      wrapper.unmount()
    }
  })

  it('carga códigos completos, limpia el municipio al seleccionar y conserva el par al recargar', async () => {
    const wrapper = await mountSuspended(SiigoMexicoLocationFields, {
      props: {
        stateCode: '02',
        municipalityCode: '02004',
        stateName: 'address.city.state_code',
        municipalityName: 'address.city.city_code'
      }
    })
    try {
      expect(wrapper.text()).toContain('Baja California')
      expect(wrapper.text()).toContain('Ciudad o municipio')
      expect(wrapper.text()).toContain('Tijuana')
      expect(wrapper.emitted('update:municipalityCode')).toBeUndefined()

      const stateSelect = wrapper.getComponent({ name: 'USelectMenu' })
      stateSelect.vm.$emit('update:modelValue', '09')
      expect(wrapper.emitted('update:stateCode')).toEqual([['09']])
      expect(wrapper.emitted('update:municipalityCode')).toEqual([['']])

      await wrapper.setProps({ stateCode: '09', municipalityCode: '09004' })
      expect(wrapper.text()).toContain('Ciudad de México')
      expect(wrapper.text()).toContain('Cuajimalpa')
      expect(wrapper.emitted('update:municipalityCode')).toEqual([['']])
    } finally {
      wrapper.unmount()
    }
  })
})
