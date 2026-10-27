import type { SiigoProduct } from '~/types/siigo'
import type { CatalogPrice } from '~/types/catalog'
import { getStoredProducts } from '../../utils/stored-products'
import { usePrisma } from '../../utils/prisma'

function productPrice(product: SiigoProduct) {
  const price = product.prices?.find(entry => entry.price_list?.some(item => item.position === 1)) ?? product.prices?.[0]
  const value = price?.price_list?.find(item => item.position === 1)?.value
    ?? price?.price_list?.[0]?.value
  const amount = typeof value === 'string' ? Number(value) : value

  return {
    price: typeof amount === 'number' && Number.isFinite(amount) ? amount : null,
    currency: price?.currency_code || 'MXN'
  }
}

export default eventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store, max-age=0')

  const products = await getStoredProducts(usePrisma())
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
})
