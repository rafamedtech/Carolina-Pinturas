export interface PersistedSiigoInvoiceReference {
  status: string
  siigoInvoiceId: string | null
}

interface VerifySiigoInvoiceOptions {
  invoice: PersistedSiigoInvoiceReference
  request: (path: string, options?: { method?: 'GET' }) => Promise<unknown>
  markMissing: (siigoInvoiceId: string) => Promise<void>
}

function errorStatus(error: unknown) {
  const candidate = error as {
    statusCode?: number
    response?: { status?: number }
  }

  return candidate.statusCode ?? candidate.response?.status
}

/**
 * Confirma en Siigo que una factura marcada localmente como creada aún existe.
 * Sólo un 404 prueba su eliminación; errores temporales o de autorización se
 * propagan para evitar habilitar una creación duplicada.
 */
export async function verifyPersistedSiigoInvoice(options: VerifySiigoInvoiceOptions) {
  const { invoice } = options
  if (invoice.status !== 'created' || !invoice.siigoInvoiceId) return true

  try {
    await options.request(`/v1/invoices/${encodeURIComponent(invoice.siigoInvoiceId)}`, {
      method: 'GET'
    })
    return true
  } catch (error: unknown) {
    if (errorStatus(error) !== 404) throw error
    await options.markMissing(invoice.siigoInvoiceId)
    return false
  }
}
