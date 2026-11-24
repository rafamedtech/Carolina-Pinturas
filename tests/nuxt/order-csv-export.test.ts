// @vitest-environment nuxt
import { afterEach, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from '#app'
import { createError, getQuery } from 'h3'
import OrderList from '~/components/orders/OrderList.vue'

mockNuxtImport('useAuth', () => () => ({
  user: { value: { id: 'admin', role: 'admin' } },
  disabled: { value: false },
  fetchSession: async () => ({ role: 'admin' })
}))

const queries: Record<string, unknown>[] = []
let denyExport = false

registerEndpoint('/api/orders/statuses', () => [])
registerEndpoint('/api/orders', (event) => {
  const query = getQuery(event)
  queries.push(query)
  const page = Number(query.page)
  if (denyExport && query.page_size === '100') throw createError({ statusCode: 403 })
  const results = query.search === 'azul'
    ? [{
        id: String(page),
        folio: page,
        number: `PED-${page}`,
        status: { key: 'confirmado', label: 'Confirmado', color: 'primary', sortOrder: 1, isTerminal: false },
        customer: { id: 'azul', name: 'Azul, "brillante"', rfc: null },
        orderDate: '2026-10-01',
        promisedDate: null,
        total: 100,
        balance: 75,
        itemCount: 1,
        paymentStatus: 'pendiente',
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z'
      }]
    : []

  return {
    results,
    filteredTotal: 200,
    pagination: { page, pageSize: Number(query.page_size), totalResults: 2, totalPages: 2 }
  }
})

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(() => {
  wrapper?.unmount()
  clearNuxtData()
  vi.restoreAllMocks()
  queries.length = 0
  denyExport = false
})

async function mountPendingOrders() {
  wrapper = await mountSuspended(OrderList, {
    route: '/ventas?view=pendiente_pago&search=azul&page=2&date_from=2026-10-01&date_to=2026-10-02'
  })
  const button = wrapper.get('button[aria-label="Exportar CSV"]')
  await vi.waitFor(() => expect(button.attributes('disabled')).toBeUndefined())
  return button
}

it('exporta todas las páginas filtradas desde Ventas con las columnas de la vista', async () => {
  const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:orders')
  const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  let filename = ''
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    filename = this.download
  })
  const button = await mountPendingOrders()

  await button.trigger('click')
  await vi.waitFor(() => expect(click).toHaveBeenCalledOnce())
  expect(filename).toMatch(/^pedidos-\d{4}-\d{2}-\d{2}\.csv$/)
  expect(queries.filter(query => query.page_size === '100')).toEqual(['1', '2'].map(page => ({
    page, page_size: '100', search: 'azul', view: 'pendiente_pago', hide_cancelled: 'true', hide_quotes: 'true',
    date_from: '2026-10-01', date_to: '2026-10-02'
  })))
  const [blob] = createUrl.mock.calls[0]!
  if (!(blob instanceof Blob)) throw new Error('La descarga debe usar un Blob.')
  const text = await blob.text()
  const lines = text.replace(/^\uFEFF/, '').split('\r\n')
  expect(lines[0]).toBe('Pedido,Fecha,Fecha prometida,Cliente,RFC,Partidas,Estado de pago,Saldo pendiente,Estado,Creado,Última actualización')
  expect(lines.slice(1).map(line => line.split(',')[0])).toEqual(['PED-1', 'PED-2'])
  expect(lines[1]).toContain(',"Azul, ""brillante""",,1,')
  await vi.waitFor(() => expect(revokeUrl).toHaveBeenCalledWith('blob:orders'))
})

it('termina la carga sin descargar cuando la API deniega la consulta', async () => {
  const createUrl = vi.spyOn(URL, 'createObjectURL')
  const button = await mountPendingOrders()
  denyExport = true

  await button.trigger('click')
  await vi.waitFor(() => expect(queries.find(query => query.page_size === '100')).toBeDefined())
  await vi.waitFor(() => expect(button.attributes('disabled')).toBeUndefined())
  expect(createUrl).not.toHaveBeenCalled()
})
