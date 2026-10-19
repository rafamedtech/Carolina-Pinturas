const SIIGO_NUBE_ORIGIN = 'https://siigonube.siigo.mx'

function validInvoiceCode(code: number | null | undefined): code is number {
  return Number.isInteger(code) && Number(code) > 0 && Number(code) <= 2147483647
}

// Rutas verificadas en Siigo México el 19/10/2026. El UUID de la API y
// document.id (tipo de comprobante) no son el código interno de la factura.
export function siigoNubeInvoiceCode(value: string): number | null {
  try {
    const url = new URL(value.trim())
    if (url.origin !== SIIGO_NUBE_ORIGIN || url.username || url.password || url.pathname !== '/' || url.search) return null
    const invoice = /^#\/invoice\/843\/([1-9]\d*)(?:\?[^#]*)?$/.exec(url.hash)
    const payment = /^#\/vouchers\/844\?invoicecode=([1-9]\d*)$/.exec(url.hash)
    const code = Number(invoice?.[1] ?? payment?.[1])
    return validInvoiceCode(code) ? code : null
  } catch {
    return null
  }
}

export function siigoNubeInvoiceUrl(code: number | null | undefined): string | null {
  return validInvoiceCode(code) ? `${SIIGO_NUBE_ORIGIN}/#/invoice/843/${code}` : null
}

export function siigoNubePaymentUrl(code: number | null | undefined): string | null {
  return validInvoiceCode(code) ? `${SIIGO_NUBE_ORIGIN}/#/vouchers/844?invoicecode=${code}` : null
}
