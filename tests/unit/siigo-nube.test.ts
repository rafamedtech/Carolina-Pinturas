import { describe, expect, it } from 'vitest'
import { siigoNubeInvoiceCode, siigoNubeInvoiceUrl, siigoNubePaymentUrl } from '../../shared/utils/siigoNube'

describe('enlaces de factura de Siigo Nube', () => {
  it('extrae el código nativo y construye enlaces de factura y pago preseleccionado', () => {
    const code = siigoNubeInvoiceCode(' https://siigonube.siigo.mx/#/invoice/843/87200?TabID=843 ')
    expect(code).toBe(87200)
    expect(siigoNubeInvoiceUrl(code)).toBe('https://siigonube.siigo.mx/#/invoice/843/87200')
    expect(siigoNubePaymentUrl(code)).toBe('https://siigonube.siigo.mx/#/vouchers/844?invoicecode=87200')
    expect(siigoNubeInvoiceCode(siigoNubePaymentUrl(code)!)).toBe(code)
  })

  it.each([
    'https://evil.test/#/invoice/843/87200',
    'https://siigonube.siigo.mx.evil.test/#/invoice/843/87200',
    'http://siigonube.siigo.mx/#/invoice/843/87200',
    'https://user:password@siigonube.siigo.mx/#/invoice/843/87200',
    'https://siigonube.siigo.mx/#/invoice/843/e6403695-032f-4711-842b-dd7b95bcf008',
    'https://siigonube.siigo.mx/#/invoice/843/0',
    'https://siigonube.siigo.mx/#/invoice/843/2147483648',
    'https://siigonube.siigo.mx/#/vouchers/844',
    'https://siigonube.siigo.mx/#/vouchers/844?invoicecode=87200&redirect=evil',
    'javascript:alert(1)'
  ])('rechaza enlaces inseguros o sin una factura identificable: %s', (url) => {
    expect(siigoNubeInvoiceCode(url)).toBeNull()
  })

  it.each([null, undefined, 0, -1, 1.2, NaN, 2147483648])('no fabrica enlaces con código inválido %s', (code) => {
    expect(siigoNubeInvoiceUrl(code)).toBeNull()
    expect(siigoNubePaymentUrl(code)).toBeNull()
  })
})
