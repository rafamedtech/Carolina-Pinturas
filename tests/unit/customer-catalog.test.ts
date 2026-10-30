import { describe, expect, it } from 'vitest'
import type { SiigoCustomer, SiigoListResponse } from '../../app/types/siigo'
import { addCustomerToCatalog, filterCustomerCatalog } from '../../app/utils/customerCatalog'

const nuevo: SiigoCustomer = { id: 'nuevo-id', name: ['María', 'López'] }
const existente: SiigoCustomer = { id: 'existente-id', name: ['Pinturas SA'] }

describe('addCustomerToCatalog', () => {
  it('crea el catálogo cuando aún no existe', () => {
    expect(addCustomerToCatalog(null, nuevo)).toEqual({
      results: [nuevo],
      pagination: { total_results: 1, page: 1, page_size: 1 }
    })
  })

  it('agrega el cliente al inicio y ajusta total_results', () => {
    const catalog: SiigoListResponse<SiigoCustomer> = {
      results: [existente],
      pagination: { total_results: 1, page: 1, page_size: 25 }
    }

    const updated = addCustomerToCatalog(catalog, nuevo)

    expect(updated.results.map(customer => customer.id)).toEqual(['nuevo-id', 'existente-id'])
    expect(updated.pagination?.total_results).toBe(2)
  })

  it('tolera catálogos sin paginación', () => {
    const updated = addCustomerToCatalog({ results: [existente] }, nuevo)
    expect(updated.results).toHaveLength(2)
    expect(updated.pagination).toBeUndefined()
  })
})

describe('catálogo unificado de clientes y proveedores', () => {
  const internal = (customer: boolean, supplier: boolean, requiresInvoice = false): NonNullable<SiigoCustomer['internal']> => ({
    roles: { customer, supplier },
    requires_invoice: requiresInvoice,
    tags: [],
    internal_orders: false,
    sync_status: 'synced',
    sync_version: 1,
    synced_at: '2026-10-29T12:00:00Z'
  })
  const customers: SiigoCustomer[] = [
    { id: 'cliente', name: ['María López'], type: 'Customer', internal: internal(true, false, true) },
    { id: 'proveedor', name: ['Pinturas SA'], type: 'Supplier', internal: internal(false, true) },
    { id: 'ambos', name: ['Distribuidora'], type: 'Supplier', rfc_id: 'AAA010101AAA', internal: internal(true, true, true) },
    { id: 'reclasificado', name: ['Servicios'], type: 'Customer', contacts: [{ email: 'ventas@servicios.test' }], internal: internal(false, true, true) }
  ]

  it('muestra todos sin duplicar terceros con ambos roles', () => {
    expect(filterCustomerCatalog(customers, 'all')).toHaveLength(4)
  })

  it('respeta ambos roles y la clasificación local aunque difiera de Siigo', () => {
    expect(filterCustomerCatalog(customers, 'clientes').map(row => row.id)).toEqual(['cliente', 'ambos'])
    expect(filterCustomerCatalog(customers, 'proveedores').map(row => row.id)).toEqual(['proveedor', 'ambos', 'reclasificado'])
  })

  it('selecciona la preferencia de factura sin restringirla al rol cliente', () => {
    expect(filterCustomerCatalog(customers, 'requieren_factura').map(row => row.id)).toEqual(['cliente', 'ambos', 'reclasificado'])
    expect(filterCustomerCatalog([{ id: 'sin-preferencia', name: ['Sin preferencia'] }], 'requieren_factura')).toEqual([])
  })

  it('combina la pestaña con la búsqueda por nombre, RFC o correo', () => {
    expect(filterCustomerCatalog(customers, 'clientes', ' PINTURAS ')).toEqual([])
    expect(filterCustomerCatalog(customers, 'proveedores', ' PINTURAS ').map(row => row.id)).toEqual(['proveedor'])
    expect(filterCustomerCatalog(customers, 'requieren_factura', 'aaa010101aaa').map(row => row.id)).toEqual(['ambos'])
    expect(filterCustomerCatalog(customers, 'proveedores', 'VENTAS@SERVICIOS').map(row => row.id)).toEqual(['reclasificado'])
  })
})
