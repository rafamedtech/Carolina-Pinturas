// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import OrderPaymentsModal from '~/components/orders/payments/OrderPaymentsModal.vue'
import OrderPaymentSiigoModal from '~/components/orders/payments/OrderPaymentSiigoModal.vue'
import type { OrderPayment, OrderPaymentContext } from '~/types/siigo-payments'

const context: OrderPaymentContext = {
  requiresInvoice: true,
  orderTotal: 110,
  paidTotal: 0,
  balance: 110,
  payments: [],
  siigo: {
    available: true,
    writeEnabled: false,
    unavailableReason: null,
    assignedInvoiceId: '313a93d7-218f-44dd-bbc5-5d3dba22936d',
    assignedInvoiceStamped: true,
    assignedInvoice: {
      id: '313a93d7-218f-44dd-bbc5-5d3dba22936d',
      name: 'FV-A-253',
      date: '2026-08-18',
      total: 110,
      balance: 110,
      customerId: '9bf22cf2-ba6b-4030-b9a6-3286ea440b61',
      customerRfc: 'VAGR8902073DA',
      stampStatus: 'Accepted',
      stamped: true
    },
    documentTypes: [],
    paymentTypes: [],
    costCenters: []
  }
}

const payment: OrderPayment = {
  id: 'payment-2',
  requestId: '19ee1240-591d-4b72-87da-ee034838553c',
  provider: 'local',
  externalStatus: 'not_applicable',
  externalError: null,
  paymentMethod: 'transferencia',
  amount: 60,
  currencyCode: 'MXN',
  paymentDate: '2026-08-18',
  reference: null,
  observations: null,
  siigo: null,
  createdBy: { name: 'Administrador', email: 'admin@example.com' },
  createdAt: '2026-08-18T12:00:00.000Z'
}

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('OrderPaymentsModal', () => {
  it('permite registrar un pago local aunque el pedido tenga factura y Siigo esté deshabilitado', async () => {
    wrapper = await mountSuspended(OrderPaymentsModal, {
      props: { open: false, context, saving: false }
    })
    await wrapper.setProps({ open: true })

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Si después se factura')
    })
    expect(document.body.textContent).not.toContain('Escritura fiscal deshabilitada')

    const saveButton = [...document.body.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === 'Guardar pago')
    expect(saveButton).toBeInstanceOf(HTMLButtonElement)
    expect((saveButton as HTMLButtonElement).disabled).toBe(false)
  })

  it('preselecciona la factura, la forma local y la siguiente parcialidad para Siigo', async () => {
    const previousPayment: OrderPayment = {
      ...payment,
      id: 'payment-1',
      provider: 'siigo',
      externalStatus: 'synced',
      siigo: {
        voucherId: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
        voucherName: 'RC-1-1',
        invoiceId: context.siigo.assignedInvoice!.id,
        invoiceName: context.siigo.assignedInvoice!.name,
        documentTypeId: 69452,
        paymentTypeId: 3560,
        costCenterId: null,
        cfdiCode: '03',
        paymentMethod: 'PUE',
        quote: 1
      }
    }
    const siigoContext: OrderPaymentContext = {
      ...context,
      payments: [previousPayment, payment],
      siigo: {
        ...context.siigo,
        writeEnabled: true,
        documentTypes: [{ id: 69452, code: '1', name: 'Recibo', active: true }],
        paymentTypes: [{ id: 3560, name: '03 - Transferencias electrónica de fondos', active: true }]
      }
    }
    wrapper = await mountSuspended(OrderPaymentSiigoModal, {
      props: { open: false, context: siigoContext, payment, saving: false }
    })
    await wrapper.setProps({ open: true })

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Condición de pago')
      expect(document.body.textContent).toContain('Forma de pago CFDI')
      expect(document.body.textContent).toContain('Método de pago CFDI')
    })

    const fields = new Map(wrapper.findAllComponents({ name: 'UFormField' }).map(field => [
      field.props('name'),
      field.props('label')
    ]))
    expect(fields.get('paymentTypeId')).toBe('Método de pago CFDI')
    expect(fields.get('cfdiCode')).toBe('Forma de pago CFDI')
    expect(fields.get('paymentMethod')).toBe('Condición de pago')

    const selectedValues = wrapper.findAllComponents({ name: 'USelect' })
      .map(component => component.props('modelValue'))
    expect(selectedValues).toContain(context.siigo.assignedInvoice!.id)
    expect(selectedValues).toContain('03')
    expect(selectedValues).toContain(3560)
    expect(wrapper.findComponent({ name: 'UInputNumber' }).props('modelValue')).toBe(2)
  })

  it('muestra la factura asignada al pedido como única opción', async () => {
    const siigoContext: OrderPaymentContext = {
      ...context,
      siigo: {
        ...context.siigo,
        documentTypes: [{ id: 69452, code: '1', name: 'Recibo', active: true }],
        paymentTypes: [{ id: 3560, name: '03 - Transferencia', active: true }]
      }
    }
    wrapper = await mountSuspended(OrderPaymentSiigoModal, {
      props: { open: false, context: siigoContext, payment, saving: false }
    })
    await wrapper.setProps({ open: true })

    const invoiceSelect = wrapper.findAllComponents({ name: 'USelect' })[0]!
    expect(invoiceSelect.props('modelValue')).toBe(context.siigo.assignedInvoice!.id)
    expect(invoiceSelect.props('items')).toEqual([expect.objectContaining({
      label: context.siigo.assignedInvoice!.name,
      value: context.siigo.assignedInvoice!.id
    })])
    expect(invoiceSelect.props('disabled')).toBe(true)
  })

  it('explica el timbrado y solicita el correo requerido por Siigo', async () => {
    const siigoContext: OrderPaymentContext = {
      ...context,
      siigo: {
        ...context.siigo,
        writeEnabled: true,
        documentTypes: [{ id: 69452, code: '1', name: 'Recibo', active: true }],
        paymentTypes: [{ id: 3560, name: '03 - Transferencia', active: true }]
      }
    }
    wrapper = await mountSuspended(OrderPaymentSiigoModal, {
      props: {
        open: false,
        context: siigoContext,
        payment,
        saving: false,
        stampAfterCreate: true
      }
    })
    await wrapper.setProps({ open: true })

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Crear y timbrar pago en Siigo')
      expect(document.body.textContent).toContain('Correo para la recepción timbrada')
      expect(document.body.textContent).toContain('Confirmo que deseo crear y timbrar')
    })
  })
})
