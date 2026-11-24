// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h, shallowRef } from 'vue'
import { AppNumberInput } from '#components'

describe('AppNumberInput', () => {
  it('conserva el importe pegado, el paso y el vacío de un gasto', async () => {
    const amount = shallowRef<number | undefined>(0)
    const wrapper = await mountSuspended(defineComponent({
      setup: () => () => h(AppNumberInput, {
        'modelValue': amount.value,
        'onUpdate:modelValue': (value) => { amount.value = value },
        'format': 'currency',
        'currency': 'USD',
        'min': 0.01,
        'max': 1234.57,
        'step': 0.01,
        'stepSnapping': false
      })
    }))

    try {
      const input = wrapper.get<HTMLInputElement>('[role="spinbutton"]')
      await input.setValue('12.34')
      await input.trigger('blur')
      expect(amount.value).toBe(12.34)

      input.element.value = '$1,234.56'
      await input.trigger('input', { inputType: 'insertFromPaste' })
      await input.trigger('blur')
      expect(amount.value).toBe(1234.56)

      const increment = wrapper.get('[data-slot="increment"] button')
      await increment.trigger('pointerdown', { button: 0 })
      window.dispatchEvent(new PointerEvent('pointerup'))
      expect(amount.value).toBe(1234.57)
      expect(increment.attributes('disabled')).toBeDefined()

      await input.setValue('')
      await input.trigger('blur')
      expect(amount.value).toBeUndefined()
      expect(input.element.value).toBe('')
    } finally {
      wrapper.unmount()
    }
  })
})
