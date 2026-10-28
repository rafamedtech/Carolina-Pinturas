import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { readFileSync } from 'node:fs'
import { productInputSchema, productQuerySchema } from '../../shared/schemas/product'
import { productDuplicateInput, productMutationInput } from '../../app/utils/siigoProductMutation'
import { canManageProducts } from '../../app/utils/roleAccess'
import { buildSiigoProductPayload, filterProducts, getActiveProducts, getProductDetail, listProducts, mutateProduct, normalizeProductList, normalizeProductOptions, normalizeSiigoProduct, validateProductReferences } from '../../server/utils/siigo-products'
import { clearSiigoCatalogCache } from '../../server/utils/siigo-catalog'
import { searchProductSat, type SatCatalog } from '../../server/utils/siigo-product-sat'

const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../../server/utils/siigo', () => ({ siigoRequest: mocks.request }))
const sat = JSON.parse(readFileSync(new URL('../../server/assets/sat/catalog.json', import.meta.url), 'utf8')) as SatCatalog
vi.stubGlobal('useStorage', () => ({ getItem: async () => sat }))
const id = '00000000-0000-4000-8000-000000000001'
const external = {
  id, code: 'PIN-1', name: 'Pintura blanca', active: true, type: 'Product', stock_control: true,
  account_group: { id: 10, name: 'Pinturas' }, unit: { code: 'H87', name: 'Pieza' }, key: '31211500',
  tax_included: true, taxes: [{ id: 5, percentage: 8 }],
  prices: [{ currency_code: 'MXN', price_list: [{ position: 1, value: 108 }] }, { currency_code: 'USD', price_list: [{ position: 2, value: 6.25 }] }],
  additional_fields: { barcode: '123', brand: 'Marca', model: 'Serie X', tariff: '1234' },
  tax_classification: 'Taxed', tax_consumption_value: 0,
  available_quantity: 20, warehouses: [{ id: 1, quantity: 20 }],
  metadata: { created: '2026-01-02T12:00:00Z', last_updated: '2026-06-02T12:00:00Z', stock_updated: '2026-09-01T12:00:00Z' }
}
function input() {
  return productMutationInput(normalizeSiigoProduct(external))
}
beforeEach(() => {
  vi.clearAllMocks()
  clearSiigoCatalogCache()
  mocks.request.mockImplementation(async (path: string, options?: { method?: string, body?: object }) => {
    if (path === '/v1/account-groups') return [{ id: 10, name: 'Pinturas', active: true }]
    if (path === '/v1/taxes') return [{ id: 5, name: 'IVA 8%', active: true }]
    if (path === '/v1/price-lists') return [{ id: 2766, position: 1, name: 'Público', active: true }, { id: 2767, position: 2, name: 'Mayoreo', active: true }]
    if (options?.method === 'POST' || options?.method === 'PUT') return external
    if (path === '/v1/products') return { results: [external], pagination: { page: 1, page_size: 100, total_results: 1 } }
    return external
  })
})

describe('contrato de productos México', () => {
  it.each([undefined, {}, { code: '' }, '', '   '])('usa H87 al editar y duplicar con unidad vacía %j', (unit) => {
    const product = { ...normalizeSiigoProduct(external), unit }
    expect(productMutationInput(product).unit).toBe('H87')
    expect(productDuplicateInput(product).unit).toBe('H87')
  })
  it.each(['LTR', { code: 'LTR', name: 'Litro' }])('conserva una unidad SAT configurada al editar y duplicar %j', (unit) => {
    const product = { ...normalizeSiigoProduct(external), unit }
    expect(productMutationInput(product).unit).toBe('LTR')
    expect(productDuplicateInput(product).unit).toBe('LTR')
  })
  it('crea simples y compuestos como Product sin control de inventario y conserva el valor al editar', () => {
    const composite = { ...input(), stock_control: false, composition: { kind: 'composite' as const, version: 1, components: [{ productId: id, quantity: '0.25' }] } }
    const payload = buildSiigoProductPayload(composite)
    expect(payload).toMatchObject({ type: 'Product', stock_control: false })
    expect(payload).not.toHaveProperty('composition')
    expect(payload).not.toHaveProperty('availability')
    expect(payload).not.toHaveProperty('components')
    expect(productInputSchema.safeParse({ ...input(), type: 'Service' }).success).toBe(false)
    expect(productInputSchema.safeParse({ ...input(), stock_control: true }).success).toBe(true)
    expect(buildSiigoProductPayload(input(), normalizeSiigoProduct(external)).stock_control).toBe(true)
    expect(productDuplicateInput(normalizeSiigoProduct(external)).stock_control).toBe(false)
  })
  it('conserva opciones independientes y permite componentes sin venta directa', () => {
    const availability = { purchase: true, sale: false, expense: false }
    const p = { ...normalizeSiigoProduct(external), internal: { availability } }
    expect(productMutationInput(p).availability).toEqual(availability)
    expect(productInputSchema.parse({ ...input(), availability }).availability).toEqual(availability)
    expect(productMutationInput().availability).toEqual({ purchase: true, sale: true, expense: false })
    expect(productMutationInput({ ...p, internal: { availability: { ...availability, expense: true } } }).availability.expense).toBe(true)
    expect(productInputSchema.parse({ ...input(), availability: undefined }).availability).toEqual({ purchase: true, sale: true, expense: false })
    expect(productInputSchema.safeParse({ ...input(), availability: { purchase: 'false', sale: true, expense: true } }).success).toBe(false)
    expect(productInputSchema.safeParse({ ...input(), availability: { purchase: false, sale: false, expense: false } }).success).toBe(true)
  })
  it('valida una receta con cantidades de base 0.25, 0.5 y 6; rechaza vacíos, repetidos y exceso de precisión', () => {
    for (const quantity of ['0.25', '0.5', '6']) expect(productInputSchema.safeParse({ ...input(), composition: { kind: 'composite', version: 1, components: [{ productId: id, quantity }] } }).success).toBe(true)
    for (const components of [[], [{ productId: id, quantity: '0' }], [{ productId: id, quantity: '-1' }], [{ productId: id, quantity: '0.0000001' }], [{ productId: id, quantity: '1' }, { productId: id, quantity: '2' }]]) expect(productInputSchema.safeParse({ ...input(), composition: { kind: 'composite', version: 1, components } }).success).toBe(false)
    expect(productInputSchema.safeParse({ ...input(), composition: { kind: 'product', version: 1, components: [{ productId: id, quantity: '1' }] } }).success).toBe(false)
  })
  it('normaliza clave SAT string, números string y unidad objeto', () => {
    expect(normalizeSiigoProduct({ ...external, available_quantity: '20', key: '31211500' })).toMatchObject({ key: { code: '31211500' }, available_quantity: 20 })
    expect(normalizeSiigoProduct({ ...external, unit: 'H87' }).unit).toEqual({ code: 'H87' })
  })
  it('tolera listado con unidad vacía y opcionales nulos', () => {
    expect(normalizeSiigoProduct({ ...external, unit: {}, reference: null })).toMatchObject({ unit: {} })
  })
  it.each([{}, { id, code: 'PIN', name: '' }, { ...external, available_quantity: 'secreto' }])('rechaza respuestas inválidas sin filtrarlas', (value) => {
    expect(() => normalizeSiigoProduct(value)).toThrow('Siigo devolvió un producto incompleto o inválido.')
  })
  it('conserva forma paginada y rechaza listas inválidas', () => {
    expect(normalizeProductList({ results: [external], pagination: { page: '1', page_size: '100', total_results: '1' } }).pagination).toEqual({ page: 1, page_size: 100, total_results: 1 })
    expect(() => normalizeProductList({ results: {} })).toThrow()
  })
  it('usa posición y no ID de lista de precio', () => {
    expect(normalizeProductOptions([{ id: 2766, position: 1, name: 'Público', active: true }], true)[0]?.id).toBe(1)
  })
  it('conserva campos editables no expuestos y excluye campos informativos', () => {
    const current = normalizeSiigoProduct(external)
    const payload = buildSiigoProductPayload({ ...input(), name: 'Nuevo nombre' }, current)
    expect(payload).toMatchObject({ name: 'Nuevo nombre', tax_classification: 'Taxed', tax_consumption_value: 0, additional_fields: { model: 'Serie X', tariff: '1234' }, prices: external.prices })
    for (const key of ['id', 'available_quantity', 'metadata', 'warehouses', 'components']) expect(payload).not.toHaveProperty(key)
  })
  it.each([true, false])('al editar conserva stock_control=%s y rechaza cambiarlo desde el navegador', async (stock_control) => {
    const current = normalizeSiigoProduct({ ...external, stock_control })
    const editable = productMutationInput(current)
    expect(editable.stock_control).toBe(stock_control)
    await expect(validateProductReferences(editable, current)).resolves.toBeUndefined()
    await expect(validateProductReferences({ ...editable, stock_control: !stock_control }, current)).rejects.toMatchObject({ statusCode: 422 })
    expect(buildSiigoProductPayload({ ...editable, stock_control: !stock_control }, current).stock_control).toBe(stock_control)
  })
  it('rechaza activar el control de inventario de Siigo al crear un producto', async () => {
    await expect(mutateProduct({ ...input(), stock_control: true })).rejects.toMatchObject({ statusCode: 422, data: { ambiguous: false } })
    expect(mocks.request.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  })
  it('preserva la configuración histórica del producto 2603S-1L-OLD al desactivar', async () => {
    const historic = { ...external, code: '2603S-1L-OLD', key: '01010101', stock_control: true }
    mocks.request.mockImplementation(async (_path, options) => options?.method === 'PUT' ? { ...historic, active: false } : historic)
    const result = await mutateProduct({ active: false }, id)
    expect(result).toMatchObject({ active: false, stock_control: true })
    const put = mocks.request.mock.calls.find(([, options]) => options?.method === 'PUT')!
    expect(put[1].body).toMatchObject({ active: false, stock_control: true, key: '01010101', code: historic.code, prices: historic.prices })
  })
  it('valida datos mínimos y elimina propiedades inyectadas', () => {
    expect(productInputSchema.parse({ ...input(), available_quantity: 999 })).not.toHaveProperty('available_quantity')
    expect(productInputSchema.safeParse(productMutationInput()).success).toBe(false)
  })
  it.each(['name', 'code', 'key', 'unit'])('exige %s', (field) => {
    expect(productInputSchema.safeParse({ ...input(), [field]: '' }).success).toBe(false)
  })
  it.each([0, -1, 1.001, NaN, Infinity])('rechaza precio %s', (value) => {
    expect(productInputSchema.safeParse({ ...input(), prices: [{ currency_code: 'MXN', price_list: [{ position: 1, value }] }] }).success).toBe(false)
  })
  it('rechaza listas repetidas o fuera del límite', () => {
    expect(productInputSchema.safeParse({ ...input(), prices: [{ currency_code: 'MXN', price_list: [{ position: 13, value: 10 }] }] }).success).toBe(false)
    expect(productInputSchema.safeParse({ ...input(), prices: [input().prices[0], input().prices[0]] }).success).toBe(false)
  })
  it('permite código alfanumérico con guion documentado', () => {
    expect(productInputSchema.safeParse({ ...input(), code: 'Item-1' }).success).toBe(true)
    expect(productInputSchema.safeParse({ ...input(), code: 'Item 1' }).success).toBe(false)
  })
})

describe('mutaciones, caché y referencias', () => {
  it('crea tras validar catálogos y SAT', async () => {
    await expect(mutateProduct({ ...input(), stock_control: false })).resolves.toMatchObject({ id })
    expect(mocks.request).toHaveBeenCalledWith('/v1/products', expect.objectContaining({ method: 'POST', body: expect.objectContaining({ key: '31211500', account_group: 10 }) }))
  })
  it('edita tras consultar detalle vigente y conserva ambas monedas', async () => {
    await mutateProduct({ ...input(), name: 'Editado' }, id)
    expect(mocks.request.mock.calls[0]?.[0]).toBe(`/v1/products/${id}`)
    expect(mocks.request).toHaveBeenCalledWith(`/v1/products/${id}`, expect.objectContaining({ method: 'PUT', body: expect.objectContaining({ prices: external.prices, additional_fields: expect.objectContaining({ model: 'Serie X' }) }) }))
  })
  it('desactivación cambia únicamente active en el payload editable', async () => {
    await mutateProduct({ active: false }, id)
    const call = mocks.request.mock.calls.find(([, opts]) => opts?.method === 'PUT')!
    expect(call[1].body).toEqual({ ...buildSiigoProductPayload(input(), normalizeSiigoProduct(external)), active: false })
    expect(call[1].body.stock_control).toBe(true)
  })
  it('permite conservar SAT histórico pero no asignarlo en alta', async () => {
    mocks.request.mockImplementationOnce(async () => ({ ...external, key: '99999999' }))
    await expect(mutateProduct({ ...input(), key: '99999999' }, id)).resolves.toMatchObject({ id })
    await expect(mutateProduct({ ...input(), stock_control: false, key: '99999999' })).rejects.toMatchObject({ statusCode: 422 })
  })
  it('rechaza IDs de catálogo desconocidos antes de escribir', async () => {
    await expect(mutateProduct({ ...input(), account_group: 999 })).rejects.toMatchObject({ statusCode: 422 })
    expect(mocks.request.mock.calls.some(([, opts]) => opts?.method === 'POST')).toBe(false)
  })
  it.each([429, 502, 504])('un fallo %s al consultar antes de editar no deja una escritura ambigua', async (statusCode) => {
    mocks.request.mockRejectedValueOnce(createError({ statusCode, statusMessage: 'No se pudo consultar Siigo.' }))
    await expect(mutateProduct(input(), id)).rejects.toMatchObject({ statusCode, data: { ambiguous: false } })
    expect(mocks.request.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false)
  })
  it('un fallo de catálogo antes de crear no deja una escritura ambigua', async () => {
    mocks.request.mockRejectedValue(createError({ statusCode: 502 }))
    await expect(mutateProduct(input())).rejects.toMatchObject({ statusCode: 502, data: { ambiguous: false } })
    expect(mocks.request.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  })
  it('no reintenta timeout ni expone datos externos', async () => {
    mocks.request.mockImplementation(async (_path, options) => {
      if (options?.method === 'PUT') throw createError({ statusCode: 504, data: { token: 'secreto' } })
      return external
    })
    await expect(mutateProduct({ active: false }, id)).rejects.toMatchObject({ statusCode: 504, data: { ambiguous: true } })
    expect(mocks.request.mock.calls.filter(([, opts]) => opts?.method === 'PUT')).toHaveLength(1)
  })
  it('conserva el código y detalle de product_service sin copiar credenciales al error público', async () => {
    mocks.request.mockImplementation(async (_path, options) => {
      if (options?.method === 'PUT') throw createError({ statusCode: 502, statusMessage: 'Siigo no pudo procesar el producto.', data: {
        errors: [{ code: 'product_service', message: 'The Products service is currently unavailable. Please try in a few minutes' }], Authorization: 'secret-token'
      } })
      return external
    })
    try {
      await mutateProduct({ active: false }, id)
      expect.unreachable('Debe fallar la actualización')
    } catch (error) {
      expect(error).toMatchObject({ data: { cause: { code: 'product_service', errors: [{ code: 'product_service' }] } } })
      expect(JSON.stringify(error)).not.toContain('secret-token')
    }
  })
  it('respuesta inválida después de escritura se considera ambigua', async () => {
    mocks.request.mockImplementation(async (_path, opts) => opts?.method === 'PUT' ? {} : external)
    await expect(mutateProduct({ active: false }, id)).rejects.toMatchObject({ data: { ambiguous: true } })
  })
  it('invalida catálogo activo y detalle tras guardar', async () => {
    await getActiveProducts()
    await getProductDetail(id)
    await mutateProduct({ active: false }, id)
    await getActiveProducts()
    await getProductDetail(id)
    expect(mocks.request.mock.calls.filter(([path, opts]) => path === '/v1/products' && !opts?.method)).toHaveLength(2)
    expect(mocks.request.mock.calls.filter(([path, opts]) => path === `/v1/products/${id}` && !opts?.method)).toHaveLength(3)
  })
  it('deduplica consultas de detalle', async () => {
    await Promise.all([getProductDetail(id), getProductDetail(id)])
    expect(mocks.request).toHaveBeenCalledTimes(1)
  })
  it('Actualizar omite caché anterior', async () => {
    await listProducts(productQuerySchema.parse({ all: 'true' }))
    await listProducts(productQuerySchema.parse({ all: 'true', refresh: 'true' }))
    expect(mocks.request).toHaveBeenCalledTimes(2)
  })
})

describe('consultas y SAT', () => {
  it('conserva activos por defecto; filtros no cambian catálogo de pedidos', async () => {
    expect(productQuerySchema.parse({}).active).toBe('true')
    const product = normalizeSiigoProduct(external)
    expect(filterProducts([product, { ...product, id: 'inactivo', active: false }], productQuerySchema.parse({ active: 'false' })).map(item => item.id)).toEqual(['inactivo'])
    expect(filterProducts([product], productQuerySchema.parse({ updated_start: '2026-09-01', updated_end: '2026-09-01' }))).toHaveLength(1)
  })
  it('valida fechas reales, orden, paginación y máximo 20 IDs', () => {
    for (const query of [{ created_start: '2026-02-30' }, { page: 0 }, { page_size: 101 }, { ids: Array(21).fill(id).join(',') }, { updated_start: '2026-09-02', updated_end: '2026-09-01' }]) expect(productQuerySchema.safeParse(query).success).toBe(false)
  })
  it('transmite filtros por query sin cambiar región', async () => {
    await listProducts(productQuerySchema.parse({ active: 'all', code: 'PIN-1', ids: id, updated_start: '2026-09-01' }))
    expect(mocks.request).toHaveBeenCalledWith('/v1/products', { query: { code: 'PIN-1', ids: id, updated_start: '2026-09-01', page: '1', page_size: '25' } })
  })
  it('catálogos completos, únicos y fechados; búsqueda paginada sin acentos', () => {
    expect(sat.catalogs.key.entries.length).toBeGreaterThan(50000)
    expect(sat.catalogs.unit.entries.length).toBeGreaterThan(1000)
    expect(searchProductSat(sat, 'key', 'pinturas', 1).results.length).toBeGreaterThan(0)
    expect(searchProductSat(sat, 'unit', 'H87', 1).results.some(item => item.code === 'H87')).toBe(true)
    expect(searchProductSat(sat, 'key', '', 2).results).toHaveLength(25)
    expect(searchProductSat(sat, 'key', '', 1).results).not.toEqual(searchProductSat(sat, 'key', '', 2).results)
    expect(sat.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it.each(['mostrador', 'vendedor', 'repartidor', 'igualaciones', undefined] as const)('rol %s no administra productos', role => expect(canManageProducts(role)).toBe(false))
  it('admin administra productos', () => expect(canManageProducts('admin')).toBe(true))
})

describe('variantes observadas el 2026-09-15', () => {
  it('acepta IDs numéricos de componentes en listado real', () => {
    expect(normalizeSiigoProduct({ ...external, type: 'Combo', components: [{ id: 1234, quantity: '2' }] }).components).toEqual([{ id: '1234', quantity: 2 }])
  })
  it('no convierte un Combo existente a Product al editar', async () => {
    mocks.request.mockResolvedValue({ ...external, type: 'Combo' })
    await expect(mutateProduct(input(), id)).rejects.toMatchObject({ statusCode: 422 })
    expect(mocks.request.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false)
  })
})
