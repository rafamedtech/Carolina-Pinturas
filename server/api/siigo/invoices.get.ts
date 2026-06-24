import type { SiigoCustomer, SiigoInvoice, SiigoListResponse } from '~/types/siigo'
import { requireUser } from '../../utils/auth'
import { listQuery, siigoRequest } from '../../utils/siigo'

function customerName(customer: SiigoCustomer) {
  return Array.isArray(customer.name) ? customer.name.filter(Boolean).join(' ') : customer.name
}

export default eventHandler(async (event) => {
  requireUser(event)

  const invoices = await siigoRequest<SiigoListResponse<SiigoInvoice>>('/v1/invoices', { query: listQuery(event) })
  const customerIds = [...new Set(invoices.results.map(invoice => invoice.customer?.id).filter((id): id is string => Boolean(id)))]
  const customers = await Promise.all(customerIds.map(async (id) => {
    try {
      const customer = await siigoRequest<SiigoCustomer>(`/v1/customers/${encodeURIComponent(id)}`)
      return [id, customerName(customer)] as const
    } catch {
      return [id, undefined] as const
    }
  }))
  const customerNames = new Map(customers)

  return {
    ...invoices,
    results: invoices.results.map((invoice) => {
      const name = invoice.customer?.id ? customerNames.get(invoice.customer.id) : undefined
      if (!name) return invoice

      return {
        ...invoice,
        customer: {
          ...invoice.customer,
          name
        }
      }
    })
  }
})
