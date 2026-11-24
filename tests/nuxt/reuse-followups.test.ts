// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { AppErrorPage, CustomerPicker, DestructiveConfirmModal, MoneyFormFields, RetryAlert, ListResponsive, ReportsSkeleton } from '#components'

describe('componentes transversales de Nuxt Shared', () => {
  it('renderiza los mismos registros para móvil y escritorio y conserva las filas al reintentar', async () => {
    const rows = [{ id: 1, label: 'Pago 1' }, { id: 2, label: 'Pago 2' }]
    const wrapper = await mountSuspended(ListResponsive<typeof rows[number]>, {
      props: { rows },
      slots: {
        table: ({ rows }) => h('ol', { 'data-test': 'table' }, rows.map(row => h('li', row.label))),
        mobile: ({ rows }) => h('ol', { 'data-test': 'mobile' }, rows.map(row => h('li', row.label)))
      }
    })

    try {
      expect(wrapper.get('[data-test="table"]').text()).toBe(wrapper.get('[data-test="mobile"]').text())
      expect(wrapper.get('[data-test="table"]').element.parentElement?.classList.contains('md:block')).toBe(true)
      expect(wrapper.get('[data-test="mobile"]').element.parentElement?.classList.contains('md:hidden')).toBe(true)

      await wrapper.setProps({ error: true })
      expect(wrapper.getComponent(RetryAlert).text()).toContain('Reintentar')
      expect(wrapper.get('[data-test="table"]').text()).toContain('Pago 2')
      await wrapper.getComponent(RetryAlert).get('button').trigger('click')
      expect(wrapper.emitted('retry')).toHaveLength(1)

      await wrapper.setProps({ error: false, loading: true, rows: [] })
      expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
      await wrapper.setProps({ error: true, loading: true })
      expect(wrapper.getComponent(RetryAlert).get('button').attributes('disabled')).toBeDefined()
    } finally {
      wrapper.unmount()
    }
  })

  it('conserva al cliente seleccionado al actualizar opciones sin recuperar otro ID', async () => {
    const selected = { label: 'Cliente A', value: 'a' }
    const other = { label: 'Cliente B', value: 'b' }
    const wrapper = await mountSuspended(CustomerPicker, {
      props: { modelValue: 'a', items: [selected] }
    })

    try {
      expect(wrapper.text()).toContain('Cliente A')
      await wrapper.setProps({ items: [other] })
      expect(wrapper.text()).toContain('Cliente A')
      await wrapper.setProps({ modelValue: 'b' })
      expect(wrapper.text()).toContain('Cliente B')
      await wrapper.setProps({ modelValue: '', items: [] })
      expect(wrapper.text()).toContain('Selecciona un cliente')
      expect(wrapper.text()).not.toContain('Cliente A')
    } finally {
      wrapper.unmount()
    }
  })

  it('conecta el importe opcional y la tasa al estado del formulario', async () => {
    const currency = ref('USD')
    const amount = ref<number | undefined>(42)
    const rate = ref<number | undefined>(18.123456)
    const Fields = MoneyFormFields<string>
    const wrapper = await mountSuspended(defineComponent({
      setup: () => () => h(Fields, {
        'currencies': [{ label: 'Pesos', value: 'MXN' }, { label: 'Dólares', value: 'USD' }],
        'currency': currency.value,
        'rate': rate.value,
        'amount': amount.value,
        'rateDisabled': currency.value === 'MXN',
        'onUpdate:amount': (value) => { amount.value = value }
      })
    }))

    try {
      const [rateInput, amountInput] = wrapper.findAll<HTMLInputElement>('[role="spinbutton"]')
      expect(rateInput?.element.value).toContain('18.123456')
      await amountInput!.setValue('')
      await amountInput!.trigger('blur')
      expect(amount.value).toBeUndefined()
      currency.value = 'MXN'
      await wrapper.vm.$nextTick()
      expect(rateInput?.attributes('disabled')).toBeDefined()
    } finally {
      wrapper.unmount()
    }
  })

  it('cancela sin confirmar y bloquea duplicados mientras se elimina', async () => {
    const open = ref(true)
    const loading = ref(false)
    const error = ref('')
    const confirm = vi.fn(() => {
      loading.value = true
    })
    const wrapper = await mountSuspended(defineComponent({
      setup: () => () => h(DestructiveConfirmModal, {
        'open': open.value,
        'title': 'Eliminar gasto de prueba',
        'confirmLabel': 'Sí, eliminar gasto',
        'loading': loading.value,
        'error': error.value,
        'onUpdate:open': (value) => { open.value = value },
        'onConfirm': confirm
      })
    }))
    const button = (label: string) => vi.waitFor(() => {
      const element = [...document.querySelectorAll('button')].find(item => item.textContent?.trim() === label)
      if (!element) throw new Error(`Botón no disponible: ${label}`)
      return element
    })

    try {
      (await button('Cancelar')).click()
      expect(open.value).toBe(false)
      expect(confirm).not.toHaveBeenCalled()

      open.value = true
      const submit = await button('Sí, eliminar gasto')
      submit.click()
      await wrapper.vm.$nextTick()
      expect(submit.disabled).toBe(true)
      submit.click()
      expect(confirm).toHaveBeenCalledOnce()

      loading.value = false
      error.value = 'El gasto cambió. Intenta nuevamente.'
      await wrapper.vm.$nextTick()
      expect(document.querySelector('[role="alert"]')?.textContent).toContain('El gasto cambió')
      expect(open.value).toBe(true)
      submit.click()
      expect(confirm).toHaveBeenCalledTimes(2)
    } finally {
      wrapper.unmount()
    }
  })

  it('localiza el error y conserva el estado HTTP', async () => {
    const wrapper = await mountSuspended(AppErrorPage, { props: { error: { statusCode: 404 } } })
    try {
      expect(wrapper.get('[data-slot="statusCode"]').text()).toBe('404')
      expect(wrapper.get('h1').text()).toBe('Página no encontrada')
      expect(wrapper.get('button').text()).toBe('Volver al inicio')
      await wrapper.setProps({ error: { statusCode: 500 } })
      expect(wrapper.get('[data-slot="statusCode"]').text()).toBe('500')
      expect(wrapper.get('h1').text()).toBe('Ocurrió un error')
      await wrapper.setProps({ error: { statusCode: 403, statusMessage: 'Tu cuenta necesita acceso al CRM.' } })
      expect(wrapper.text()).toContain('Tu cuenta necesita acceso al CRM.')
    } finally {
      wrapper.unmount()
    }
  })

  it('anuncia la carga del reporte una vez y reserva espacio para las métricas', async () => {
    const wrapper = await mountSuspended(ReportsSkeleton, {
      props: { variant: 'metrics', count: 4, label: 'Cargando datos del reporte' }
    })
    try {
      expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
      expect(wrapper.findAll('[aria-hidden="true"]')).toHaveLength(4)
      expect(wrapper.classes()).toContain('xl:grid-cols-4')
    } finally {
      wrapper.unmount()
    }
  })
})
