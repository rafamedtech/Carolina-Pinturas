import type { SiigoListResponse, SiigoProduct } from '~/types/siigo'
import type { CatalogPrice } from '~/types/catalog'
import { siigoRequest } from '../../utils/siigo'

const SIIGO_PAGE_SIZE = 25

function productPrice(product: SiigoProduct) {
  const price = product.prices?.find(entry => entry.price_list?.some(item => item.position === 1)) ?? product.prices?.[0]
  const value = price?.price_list?.find(item => item.position === 1)?.value
    ?? price?.price_list?.[0]?.value
    ?? product.price
  const amount = typeof value === 'string' ? Number(value) : value

  return {
    price: typeof amount === 'number' && Number.isFinite(amount) ? amount : null,
    currency: price?.currency_code || 'MXN'
  }
}

async function getProducts() {
  const firstPage = await siigoRequest<SiigoListResponse<SiigoProduct>>('/v1/products', {
    query: { page: '1', page_size: String(SIIGO_PAGE_SIZE) }
  })
  const products = [...firstPage.results]
  const total = firstPage.pagination?.total_results || products.length

  for (let page = 2; page <= Math.ceil(total / SIIGO_PAGE_SIZE); page++) {
    const response = await siigoRequest<SiigoListResponse<SiigoProduct>>('/v1/products', {
      query: { page: String(page), page_size: String(SIIGO_PAGE_SIZE) }
    })
    products.push(...response.results)
  }

  return products
}

export default defineCachedEventHandler(async () => {
  const products = await getProducts()
  const catalog: CatalogPrice[] = products
    .filter(product => product.active !== false)
    .map(product => ({
      code: product.code,
      name: product.name,
      reference: product.reference,
      type: product.type,
      availableQuantity: product.available_quantity,
      stockControl: product.stock_control,
      ...productPrice(product)
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es-MX'))

  return {
    updatedAt: new Date().toISOString(),
    products: catalog
  }
}, {
  maxAge: 300,
  name: 'public-price-catalog'
})
