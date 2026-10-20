// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { DOMWrapper } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import OrderPaymentsModal from '~/components/orders/payments/OrderPaymentsModal.vue'
import OrderPaymentSiigoModal from '~/components/orders/payments/OrderPaymentSiigoModal.vue'
import type { OrderPayment, OrderPaymentContext } from '~/types/siigo-payments'
import { createOrderPaymentSchema } from '../../server/utils/order-payments'

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
  paymentDate: '2026-10-13',
  reference: null,
  observations: null,
  siigo: null,
  createdBy: { name: 'Administrador', email: 'admin@example.com' },
  createdAt: '2026-08-18T12:00:00.000Z'
}

let wrapper: VueWrapper | null = null

beforeEach(() => vi.setSystemTime(new Date('2026-10-13T18:00:00Z')))
afterEach(() => {
  vi.useRealTimers()
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('OrderPaymentsModal', () => {
  it.each([
    [758.505, 758.51],
    [1.005, 1.01],
    [0.09999999999999998, 0.1],
    [0.01, 0.01]
  ])('precarga el saldo %s a centavos y envía un pago válido de %s', async (balance, amount) => {
    wrapper = await mountSuspended(OrderPaymentsModal, {
      props: { open: true, context: { ...context, balance }, saving: false }
    })
    expect(wrapper.findComponent({ name: 'UInputNumber' }).props('modelValue')).toBe(amount)
    expect(wrapper.findComponent({ name: 'UInputNumber' }).props('max')).toBe(amount)
    expect(document.querySelector<HTMLInputElement>('input[role="spinbutton"]')?.value).toBe(amount.toFixed(2))
    document.querySelector<HTMLFormElement>('#order-payment-form')!.requestSubmit()
    await vi.waitFor(() => expect(wrapper?.emitted('submit')?.[0]?.[0]).toMatchObject({ amount }))
    expect(createOrderPaymentSchema.safeParse(wrapper.emitted('submit')![0]![0]).success).toBe(true)
  })

  it.each([758.51, 758.5, 758.01, 100.1, 0.01])('conserva el importe manual %s al salir del campo y enviarlo', async (amount) => {
    wrapper = await mountSuspended(OrderPaymentsModal, {
      props: { open: true, context: { ...context, balance: 758.505 }, saving: false }
    })
    const input = document.querySelector<HTMLInputElement>('input[role="spinbutton"]')!
    await vi.waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Close'))
    const field = new DOMWrapper(input)
    await field.setValue(String(amount))
    await field.trigger('blur')
    expect(input.value).toBe(amount.toFixed(2))
    document.querySelector<HTMLFormElement>('#order-payment-form')!.requestSubmit()
    await vi.waitFor(() => expect(wrapper?.emitted('submit')?.[0]?.[0]).toMatchObject({ amount }))
    expect(createOrderPaymentSchema.safeParse(wrapper.emitted('submit')![0]![0]).success).toBe(true)
  })

  it.each([
    ['tarjeta_credito', '04 - Tarjeta de crédito'],
    ['tarjeta_debito', '28 - Tarjeta de débito']
  ])('muestra las formas de Siigo y guarda %s sin perder la distinción de tarjeta', async (method, label) => {
    wrapper = await mountSuspended(OrderPaymentsModal, {
      props: { open: false, context, saving: false }
    })
    await wrapper.setProps({ open: true })
    const field = wrapper.findAllComponents({ name: 'UFormField' }).find(component => component.props('name') === 'paymentMethod')!
    const select = field.findComponent({ name: 'USelect' })
    const items = select.props('items') as Array<{ label: string, value: string }>
    expect(items).toContainEqual({ label, value: method })
    expect(items).toContainEqual({ label: '03 - Transferencia electrónica de fondos', value: 'transferencia' })
    expect(items.map(item => item.value)).not.toContain('tarjeta')
    expect(items.map(item => item.value)).not.toContain('otro')
    select.vm.$emit('update:modelValue', method)
    await wrapper.vm.$nextTick()
    document.querySelector('#order-payment-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await vi.waitFor(() => expect(wrapper?.emitted('submit')?.[0]).toEqual([expect.objectContaining({
      destination: 'local', paymentMethod: method, amount: 110, date: '2026-10-13'
    })]))
  })

  it('exige distinguir crédito y débito cuando el pago local solo indica tarjeta', async () => {
    wrapper = await mountSuspended(OrderPaymentSiigoModal, {
      props: {
        open: true,
        context: { ...context, siigo: { ...context.siigo, paymentTypes: [
          { id: 3561, name: '04 - Tarjeta de crédito', active: true },
          { id: 3562, name: '28 - Tarjeta de débito', active: true }
        ] } },
        payment: { ...payment, paymentMethod: 'tarjeta' }, saving: false, stampAfterCreate: true
      }
    })
    const field = wrapper.findAllComponents({ name: 'UFormField' }).find(component => component.props('name') === 'cfdiCode')
    expect(field?.findComponent({ name: 'USelect' }).props('modelValue')).toBe('')
    expect(document.body.textContent).toContain('04 para tarjeta de crédito o 28 para tarjeta de débito')
    const methodField = wrapper.findAllComponents({ name: 'UFormField' }).find(component => component.props('name') === 'paymentMethod')
    expect(methodField?.findComponent({ name: 'USelect' }).props('modelValue')).toBe('PPD')
    expect(methodField?.findComponent({ name: 'USelect' }).props('disabled')).toBe(true)
    field?.findComponent({ name: 'USelect' }).vm.$emit('update:modelValue', '04')
    await wrapper.vm.$nextTick()
    const incomeField = wrapper.findAllComponents({ name: 'UFormField' }).find(component => component.props('name') === 'paymentTypeId')
    expect(incomeField?.findComponent({ name: 'USelect' }).props('modelValue')).toBe(3561)
  })

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
      expect(document.body.textContent).toContain('Condición de ingreso en Siigo')
      expect(document.body.textContent).toContain('Forma de pago CFDI')
      expect(document.body.textContent).toContain('Método de pago CFDI')
    })

    const fields = new Map(wrapper.findAllComponents({ name: 'UFormField' }).map(field => [
      field.props('name'),
      field.props('label')
    ]))
    expect(fields.get('paymentTypeId')).toBe('Condición de ingreso en Siigo')
    expect(fields.get('cfdiCode')).toBe('Forma de pago CFDI')
    expect(fields.get('paymentMethod')).toBe('Método de pago CFDI de la recepción')

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

  it('confirma la fecha real del pago y muestra el correo de Siigo sin edición', async () => {
    const siigoContext: OrderPaymentContext = {
      ...context,
      siigo: {
        ...context.siigo,
        writeEnabled: true,
        customerEmail: 'cliente@example.com',
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

    expect(wrapper.findComponent({ name: 'UInput' }).props('modelValue')).toBe('cliente@example.com')
    expect(document.querySelector('input[readonly]')).not.toBeNull()
    await wrapper.findComponent({ name: 'UCheckbox' }).setValue(true)
    document.querySelector<HTMLFormElement>('#siigo-payment-form')?.requestSubmit()

    await vi.waitFor(() => {
      expect(wrapper?.emitted('submit')?.[0]).toEqual([expect.objectContaining({
        stamp: true,
        paymentDate: '2026-10-13',
        confirmation: 'CREAR_Y_TIMBRAR_RECEPCION_SIIGO'
      })])
    })
    expect(wrapper?.emitted('submit')?.[0]?.[0]).not.toHaveProperty('stampEmail')
  })

  it('no bloquea el envío cuando el correo opcional oculto está vacío', async () => {
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
      props: { open: false, context: siigoContext, payment, saving: false }
    })
    await wrapper.setProps({ open: true })
    await wrapper.findComponent({ name: 'UCheckbox' }).setValue(true)
    document.querySelector<HTMLFormElement>('#siigo-payment-form')?.requestSubmit()

    await vi.waitFor(() => {
      expect(wrapper?.emitted('submit')?.[0]).toEqual([expect.objectContaining({
        invoiceId: context.siigo.assignedInvoice!.id,
        stamp: undefined,
        confirmation: 'CREAR_RECEPCION_SIIGO'
      })])
    })
  })

  it('confirma el timbrado de una recepción existente sin cambiar fechas', async () => {
    const siigoContext: OrderPaymentContext = {
      ...context,
      siigo: {
        ...context.siigo,
        writeEnabled: true,
        customerEmail: 'cliente@example.com',
        documentTypes: [{ id: 69452, code: '1', name: 'Recibo', active: true }],
        paymentTypes: [{ id: 3560, name: '03 - Transferencia', active: true }]
      }
    }
    wrapper = await mountSuspended(OrderPaymentSiigoModal, {
      props: {
        open: true, context: siigoContext, saving: false, stampAfterCreate: true,
        payment: {
          ...payment,
          provider: 'siigo', externalStatus: 'failed',
          siigo: {
            voucherId: '497f6eca-6276-4993-bfeb-53cbbbba6f08', voucherName: 'RC-1-22',
            invoiceId: context.siigo.assignedInvoice!.id, invoiceName: context.siigo.assignedInvoice!.name,
            documentTypeId: 69452, paymentTypeId: 3560, costCenterId: null, cfdiCode: '03', paymentMethod: 'PUE', quote: 2
          }
        }
      }
    })
    expect(document.body.textContent).toContain('Timbrar recepción existente')
    expect(wrapper.findAllComponents({ name: 'USelect' }).every(select => select.props('disabled'))).toBe(true)
    await wrapper.findComponent({ name: 'UCheckbox' }).setValue(true)
    document.querySelector<HTMLFormElement>('#siigo-payment-form')?.requestSubmit()
    await vi.waitFor(() => expect(wrapper?.emitted('submit')?.[0]).toEqual([expect.objectContaining({
      confirmation: 'TIMBRAR_RECEPCION_SIIGO', stamp: true, quote: 2
    })]))
  })

  it('explica la limitación del pago del 02/10 y no ofrece cambiar su fecha por hoy', async () => {
    wrapper = await mountSuspended(OrderPaymentSiigoModal, {
      props: {
        open: true,
        payment: { ...payment, paymentDate: '2026-10-02' },
        saving: false,
        stampAfterCreate: true,
        context: {
          ...context,
          siigo: {
            ...context.siigo, writeEnabled: true, customerEmail: 'cliente@example.com',
            documentTypes: [{ id: 69452, code: '1', name: 'Recibo', active: true }],
            paymentTypes: [{ id: 3560, name: '03 - Transferencia', active: true }]
          }
        }
      }
    })
    expect(document.body.textContent).toContain('02/10/2026')
    expect(document.body.textContent).toContain('El timbrado se solicitará hoy, 13/10/2026')
    expect(document.body.textContent).toContain('no documenta una fecha de emisión independiente')
    expect(document.body.textContent).not.toContain('Fecha de emisión de la recepción')
    const submit = wrapper.findAllComponents({ name: 'UButton' }).find(button => button.props('label') === 'Crear y timbrar')
    expect(submit?.props('disabled')).toBe(true)
    expect(wrapper.findAllComponents({ name: 'UButton' }).some(button => button.props('label') === 'Abrir Siigo Nube')).toBe(true)
  })

  it('reemplaza la condición de vencimiento de un intento fallido por la condición del ingreso', async () => {
    wrapper = await mountSuspended(OrderPaymentSiigoModal, {
      props: {
        open: true, saving: false, stampAfterCreate: true,
        payment: {
          ...payment, provider: 'siigo', externalStatus: 'failed',
          siigo: {
            voucherId: null, voucherName: null,
            invoiceId: context.siigo.assignedInvoice!.id, invoiceName: context.siigo.assignedInvoice!.name,
            documentTypeId: 69452, paymentTypeId: 3564, costCenterId: null, cfdiCode: '04', paymentMethod: 'PPD', quote: 1
          }
        },
        context: {
          ...context,
          siigo: {
            ...context.siigo, writeEnabled: true, customerEmail: 'cliente@example.com',
            documentTypes: [{ id: 69452, code: '1', name: 'Recibo', active: true }],
            paymentTypes: [
              { id: 3564, name: 'Crédito Clientes', active: true, due_date: true },
              { id: 3561, name: '04 - Tarjeta de crédito', active: true, due_date: false }
            ]
          }
        }
      }
    })
    const select = wrapper.findAllComponents({ name: 'USelect' }).find(component => component.props('modelValue') === 3561)
    expect(select?.props('items')).toEqual([{ label: '04 - Tarjeta de crédito', description: undefined, value: 3561 }])
    expect(document.body.textContent).not.toContain('Crédito Clientes')
  })
})
