// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import OrderFormActions from '~/components/orders/OrderFormActions.vue'

describe('OrderFormActions', () => {
  it('oculta guardar como cotización en una venta de mostrador', async () => {
    const wrapper = await mountSuspended(OrderFormActions, {
      props: {
        saving: false,
        savingDraft: false,
        disabled: false,
        quoteMode: false,
        showSaveDraft: false
      }
    })

    expect(wrapper.text()).not.toContain('Guardar como cotización')
    expect(wrapper.text()).toContain('Revisar pedido')
  })

  it('identifica la revisión de cambios al editar', async () => {
    const wrapper = await mountSuspended(OrderFormActions, {
      props: {
        saving: false,
        savingDraft: false,
        disabled: false,
        editing: true,
        quoteMode: false,
        showSaveDraft: false
      }
    })

    expect(wrapper.text()).toContain('Revisar cambios')
    expect(wrapper.text()).not.toContain('Guardar como cotización')
  })
})
