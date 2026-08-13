// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import OrderReviewActions from '~/components/orders/OrderReviewActions.vue'

const baseProps = {
  isDeliverySale: false,
  isCounterSale: false,
  maySaveDraft: true,
  mayManagePayment: true,
  saving: false,
  submissionIntent: null,
  sendBlocked: false,
  sendButtonLabel: 'Enviar',
  documentNoun: 'pedido'
}

describe('OrderReviewActions', () => {
  it('muestra únicamente Editar y Enviar para pedidos a domicilio', async () => {
    const wrapper = await mountSuspended(OrderReviewActions, {
      props: { ...baseProps, isDeliverySale: true }
    })

    const labels = wrapper.findAll('button').map(button => button.text().trim())

    expect(labels).toEqual(['Editar', 'Enviar'])
    expect(wrapper.text()).not.toContain('Enviar y pagar')
    expect(wrapper.text()).not.toContain('Guardar cotización')
  })

  it('conserva Guardar pedido y Guardar y pagar para venta de mostrador', async () => {
    const wrapper = await mountSuspended(OrderReviewActions, {
      props: { ...baseProps, isCounterSale: true }
    })

    expect(wrapper.text()).toContain('Guardar pedido')
    expect(wrapper.text()).toContain('Guardar y pagar')
  })

  it('muestra una sola acción de guardado al editar un pedido', async () => {
    const wrapper = await mountSuspended(OrderReviewActions, {
      props: { ...baseProps, editing: true, isDeliverySale: true }
    })

    expect(wrapper.findAll('button').map(button => button.text().trim()))
      .toEqual(['Editar', 'Guardar cambios'])
  })
})
