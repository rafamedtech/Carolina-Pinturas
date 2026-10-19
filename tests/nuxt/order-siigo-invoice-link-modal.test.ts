// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import type { VueWrapper } from '@vue/test-utils'
import OrderSiigoInvoiceLinkModal from '~/components/orders/payments/OrderSiigoInvoiceLinkModal.vue'

const savedInput = vi.fn()
registerEndpoint('/api/orders/order-link/siigo-invoice/nube-link', {
  method: 'PATCH',
  handler: async (event) => {
    savedInput(await readBody(event))
    return { invoiceNubeCode: 87200 }
  }
})
let wrapper: VueWrapper | null = null
const invoiceId = 'e6403695-032f-4711-842b-dd7b95bcf008'
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  savedInput.mockClear()
})
async function mount() {
  wrapper = await mountSuspended(OrderSiigoInvoiceLinkModal, {
    props: { open: false, orderId: 'order-link', invoiceId, invoiceName: 'FV-A-272' }
  })
  await wrapper.setProps({ open: true })
}
function saveButton() {
  return wrapper!.findAllComponents({ name: 'UButton' }).find(button => button.props('label') === 'Guardar enlace')!
}

describe('vincular enlace nativo de factura', () => {
  it('exige un enlace válido y confirmación del folio antes de guardar', async () => {
    await mount()
    const input = wrapper!.findComponent({ name: 'UInput' })
    const checkbox = wrapper!.findComponent({ name: 'UCheckbox' })
    expect(saveButton().props('disabled')).toBe(true)
    await input.vm.$emit('update:modelValue', 'https://evil.test/#/invoice/843/87200')
    await checkbox.vm.$emit('update:modelValue', true)
    await vi.waitFor(() => expect(saveButton().props('disabled')).toBe(true))
    await input.vm.$emit('update:modelValue', 'https://siigonube.siigo.mx/#/invoice/843/87200')
    await vi.waitFor(() => expect(saveButton().props('disabled')).toBe(false))
    document.querySelector('#siigo-invoice-link-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await vi.waitFor(() => expect(wrapper!.emitted('saved')).toEqual([[87200]]))
    expect(savedInput).toHaveBeenCalledWith({ invoiceId, url: 'https://siigonube.siigo.mx/#/invoice/843/87200', confirmed: true })
  })

  it('abre la edición con el enlace guardado y vuelve a pedir confirmación', async () => {
    await mount()
    await wrapper!.setProps({ open: false, invoiceCode: 87200 })
    await wrapper!.setProps({ open: true })
    expect(wrapper!.findComponent({ name: 'UInput' }).props('modelValue')).toBe('https://siigonube.siigo.mx/#/invoice/843/87200')
    expect(saveButton().props('disabled')).toBe(true)
  })
})
