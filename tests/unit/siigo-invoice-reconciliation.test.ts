import { describe, expect, it, vi } from 'vitest'
import { verifyPersistedSiigoInvoice } from '../../server/utils/siigo-invoice-reconciliation'

const invoiceId = '63f918c2-ca65-4edc-a7db-66bcdd5159fb'

function dependencies() {
  return {
    invoice: { status: 'created', siigoInvoiceId: invoiceId },
    request: vi.fn().mockResolvedValue({ id: invoiceId }),
    markMissing: vi.fn().mockResolvedValue(undefined)
  }
}

describe('conciliación de factura de pedido con Siigo', () => {
  it('mantiene el bloqueo cuando la factura todavía existe', async () => {
    const deps = dependencies()

    await expect(verifyPersistedSiigoInvoice(deps)).resolves.toBe(true)

    expect(deps.request).toHaveBeenCalledWith(`/v1/invoices/${invoiceId}`, { method: 'GET' })
    expect(deps.markMissing).not.toHaveBeenCalled()
  })

  it('marca la referencia como eliminada sólo cuando Siigo responde 404', async () => {
    const deps = dependencies()
    deps.request.mockRejectedValue({ statusCode: 404 })

    await expect(verifyPersistedSiigoInvoice(deps)).resolves.toBe(false)

    expect(deps.markMissing).toHaveBeenCalledWith(invoiceId)
  })

  it('no habilita otra factura ante un error temporal o de autorización', async () => {
    const deps = dependencies()
    const error = { statusCode: 502, statusMessage: 'Siigo no respondió.' }
    deps.request.mockRejectedValue(error)

    await expect(verifyPersistedSiigoInvoice(deps)).rejects.toBe(error)
    expect(deps.markMissing).not.toHaveBeenCalled()
  })
})
