import * as z from 'zod'
import { createError } from 'h3'
import type { SiigoListResponse, SiigoProduct } from '~/types/siigo'
import type { ProductCatalogOption, ProductContext, ProductInput } from '~/types/siigo-products'
import { productInputSchema, type ProductQuery } from '#shared/schemas/product'
import { productMutationInput } from '../../app/utils/siigoProductMutation'
import { siigoRequest } from './siigo'
import { cachedSiigoCatalog, collectSiigoCatalog, invalidateSiigoCatalog } from './siigo-catalog'
import { getProductSatCatalog } from './siigo-product-sat'

const number = z.union([z.number(), z.string().trim().min(1)]).transform(Number).pipe(z.number().finite())
const optionalNumber = number.nullish().transform(value => value ?? undefined)
const optionalText = z.string().nullish().transform(value => value ?? undefined)
const codeName = z.union([z.string().transform(code => ({ code })), z.object({ code: optionalText, name: optionalText })])
const optionalBoolean = z.boolean().nullish().transform(value => value ?? undefined)
const productResponseSchema = z.object({
  id: z.string().min(1), code: z.string().min(1), name: z.string().min(1),
  type: optionalText, active: optionalBoolean, stock_control: optionalBoolean, tax_included: optionalBoolean,
  tax_classification: optionalText, tax_consumption_value: optionalNumber,
  unit: codeName.nullish().transform(value => value ?? undefined),
  key: codeName.nullish().transform(value => value ?? undefined),
  account_group: z.object({ id: optionalNumber, name: optionalText }).nullish().transform(value => value ?? undefined),
  additional_fields: z.object({ barcode: optionalText, brand: optionalText, model: optionalText, tariff: optionalText }).nullish().transform(value => value ?? undefined),
  reference: optionalText, description: optionalText, available_quantity: optionalNumber,
  taxes: z.array(z.object({ id: optionalNumber, name: optionalText, type: optionalText, percentage: optionalNumber })).nullish().transform(value => value ?? undefined),
  prices: z.array(z.object({ currency_code: optionalText, price_list: z.array(z.object({ position: optionalNumber, name: optionalText, value: optionalNumber })).optional() })).nullish().transform(value => value ?? undefined),
  warehouses: z.array(z.object({ id: optionalNumber, name: optionalText, quantity: optionalNumber })).nullish().transform(value => value ?? undefined),
  components: z.array(z.object({ id: z.union([z.string(), z.number()]).nullish().transform(value => value == null ? undefined : String(value)), name: optionalText, quantity: optionalNumber })).nullish().transform(value => value ?? undefined),
  metadata: z.object({ created: optionalText, last_updated: optionalText, stock_updated: optionalText }).nullish().transform(value => value ?? undefined)
})
export function normalizeSiigoProduct(input: unknown): SiigoProduct {
  const parsed = productResponseSchema.safeParse(input)
  if (!parsed.success) throw createError({ statusCode: 502, statusMessage: 'Siigo devolvió un producto incompleto o inválido.' })
  return parsed.data
}
export function normalizeProductList(input: unknown): SiigoListResponse<SiigoProduct> {
  const parsed = z.object({
    results: z.array(z.unknown()),
    pagination: z.object({ page: number, page_size: number, total_results: number }).optional()
  }).safeParse(input)
  if (!parsed.success) throw createError({ statusCode: 502, statusMessage: 'Siigo devolvió un catálogo inválido.' })
  return { results: parsed.data.results.map(normalizeSiigoProduct), pagination: parsed.data.pagination }
}

export function buildSiigoProductPayload(input: ProductInput, current?: SiigoProduct) {
  // Only writable fields, never spread an external response into a request.
  return {
    ...input,
    taxes: input.taxes.map(({ id }) => ({ id })),
    prices: input.prices.map(group => ({ currency_code: group.currency_code, price_list: group.price_list.map(({ position, value }) => ({ position, value })) })),
    additional_fields: {
      ...(current?.additional_fields?.tariff !== undefined ? { tariff: current.additional_fields.tariff } : {}),
      ...(current?.additional_fields?.model !== undefined ? { model: current.additional_fields.model } : {}),
      ...input.additional_fields
    },
    ...(current?.tax_classification !== undefined ? { tax_classification: current.tax_classification } : {}),
    ...(current?.tax_consumption_value !== undefined ? { tax_consumption_value: current.tax_consumption_value } : {})
  }
}

export function normalizeProductOptions(input: unknown, priceLists = false): ProductCatalogOption[] {
  const parsed = z.array(z.object({
    id: optionalNumber, position: optionalNumber, name: z.string().min(1), active: z.boolean().optional()
  })).safeParse(input)
  if (!parsed.success) throw createError({ statusCode: 502, statusMessage: 'Siigo devolvió opciones de producto inválidas.' })
  return parsed.data.map((item) => {
    const id = priceLists ? item.position ?? item.id : item.id
    if (!id || (priceLists && id > 12)) throw createError({ statusCode: 502, statusMessage: 'Una opción de producto no tiene identificador válido.' })
    return { id, name: item.name, active: item.active !== false }
  })
}
export async function getProductContext(): Promise<ProductContext> {
  const result = await cachedSiigoCatalog<ProductContext>('product-context', async () => {
    const [groups, taxes, prices] = await Promise.all([
      siigoRequest<unknown>('/v1/account-groups'), siigoRequest<unknown>('/v1/taxes'), siigoRequest<unknown>('/v1/price-lists')
    ])
    return { results: [{ accountGroups: normalizeProductOptions(groups), taxes: normalizeProductOptions(taxes), priceLists: normalizeProductOptions(prices, true) }] }
  })
  return result.results[0]!
}
export async function validateProductReferences(input: ProductInput, current?: SiigoProduct) {
  const [context, sat] = await Promise.all([getProductContext(), getProductSatCatalog()])
  const previous = current ? productMutationInput(current) : undefined
  const validOption = (items: ProductCatalogOption[], id: number) => items.some(item => item.id === id && item.active)
  const errors: string[] = []
  if (input.account_group !== previous?.account_group && !validOption(context.accountGroups, input.account_group)) errors.push('Selecciona una clasificación activa.')
  for (const tax of input.taxes) {
    if (!previous?.taxes.some(item => item.id === tax.id) && !validOption(context.taxes, tax.id)) errors.push('Selecciona impuestos activos de Siigo.')
  }
  for (const price of input.prices.flatMap(group => group.price_list)) {
    if (!previous?.prices.some(group => group.price_list.some(item => item.position === price.position)) && !validOption(context.priceLists, price.position)) errors.push('Selecciona listas de precios habilitadas.')
  }
  for (const kind of ['unit', 'key'] as const) {
    if (input[kind] !== previous?.[kind] && !sat.catalogs[kind].entries.some(entry => entry.code === input[kind])) errors.push(kind === 'unit' ? 'Selecciona una unidad SAT del catálogo.' : 'Selecciona una clave SAT del catálogo.')
  }
  if (errors.length) throw createError({ statusCode: 422, statusMessage: [...new Set(errors)].join(' ') })
}

// A finite cache namespace: filtered full catalogs are computed from one master catalog.
export function invalidateProductCaches() {
  for (const key of ['active-products', 'all-products', 'product-context']) invalidateSiigoCatalog(key)
  for (const key of detailKeys) invalidateSiigoCatalog(key)
  detailKeys.clear()
}
const detailKeys = new Set<string>()
export async function getProductDetail(id: string, fresh = false) {
  const key = `product-detail:${id}`
  if (fresh) invalidateSiigoCatalog(key)
  if (detailKeys.size >= 1000) {
    for (const oldKey of detailKeys) invalidateSiigoCatalog(oldKey)
    detailKeys.clear()
  }
  detailKeys.add(key)
  const result = await cachedSiigoCatalog(key, async () => ({ results: [normalizeSiigoProduct(await siigoRequest<unknown>(`/v1/products/${encodeURIComponent(id)}`))] }))
  return result.results[0]!
}
export async function getActiveProducts() {
  return cachedSiigoCatalog('active-products', () => collectSiigoCatalog(async (page, size) => normalizeProductList(await siigoRequest<unknown>('/v1/products', { query: { active: 'true', page: String(page), page_size: String(size) } }))))
}
export function filterProducts(products: SiigoProduct[], query: ProductQuery) {
  return products.filter((product) => {
    if (query.active !== 'all' && (product.active !== false) !== (query.active === 'true')) return false
    if (query.code && product.code !== query.code) return false
    if (query.ids && !query.ids.includes(product.id)) return false
    for (const kind of ['created', 'updated'] as const) {
      const start = query[`${kind}_start`]
      const end = query[`${kind}_end`]
      const value = kind === 'created' ? product.metadata?.created : [product.metadata?.last_updated, product.metadata?.stock_updated].filter(Boolean).sort().at(-1)
      if ((start || end) && !value) return false
      const date = value?.slice(0, 10) ?? ''
      if (start && date < start) return false
      if (end && date > end) return false
    }
    return true
  })
}
export async function listProducts(query: ProductQuery) {
  if (query.refresh === 'true') invalidateProductCaches()
  const { all, refresh: _refresh, ...filters } = query
  if (all === 'true') {
    const catalog = query.active === 'true' ? await getActiveProducts() : await cachedSiigoCatalog('all-products', () => collectSiigoCatalog(async (page, size) => normalizeProductList(await siigoRequest<unknown>('/v1/products', { query: { page: String(page), page_size: String(size) } }))))
    const results = filterProducts(catalog.results, query)
    return { results, pagination: { page: 1, page_size: results.length, total_results: results.length } }
  }
  const queryParams = Object.fromEntries(Object.entries(filters).filter(([key, value]) => value !== undefined && !(key === 'active' && value === 'all')).map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : String(value)]))
  return normalizeProductList(await siigoRequest<unknown>('/v1/products', { query: queryParams }))
}

export async function mutateProduct(input: ProductInput | { active: boolean }, id?: string) {
  const current = id ? normalizeSiigoProduct(await siigoRequest<unknown>(`/v1/products/${encodeURIComponent(id)}`)) : undefined
  if (current && !['Product', 'Service', 'ConsumerGood'].includes(current.type || 'Product')) throw createError({ statusCode: 422, statusMessage: 'Este tipo de producto se administra directamente en Siigo.' })
  const parsed = productInputSchema.safeParse('code' in input ? input : { ...productMutationInput(current), active: input.active })
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Completa los datos del producto antes de guardarlo.', data: { issues: parsed.error.issues.map(issue => ({ path: issue.path, message: issue.message })) } })
  if ('code' in input) await validateProductReferences(parsed.data, current)
  let response: unknown
  try {
    response = await siigoRequest<unknown>(id ? `/v1/products/${encodeURIComponent(id)}` : '/v1/products', {
      method: id ? 'PUT' : 'POST', body: buildSiigoProductPayload(parsed.data, current)
    })
    const product = normalizeSiigoProduct(response)
    invalidateProductCaches()
    return product
  } catch (error: unknown) {
    const status = (error as { statusCode?: number }).statusCode ?? 502
    const ambiguous = status >= 500
    invalidateProductCaches()
    throw createError({
      statusCode: status,
      statusMessage: ambiguous ? 'No se pudo confirmar el guardado. Consulta el producto antes de volver a intentar.' : ((error as { statusMessage?: string }).statusMessage || 'Siigo rechazó los datos del producto.'),
      data: { ambiguous, productId: id, code: parsed.data.code }
    })
  }
}
