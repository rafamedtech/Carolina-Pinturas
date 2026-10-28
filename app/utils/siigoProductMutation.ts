import type { SiigoProduct } from '~/types/siigo'
import type { ProductInput } from '~/types/siigo-products'

export function productDuplicateInput(product: SiigoProduct): ProductInput {
  const input = productMutationInput(product)
  input.code = ''
  input.stock_control = false
  input.additional_fields.barcode = ''
  input.composition.version = 1
  return input
}

export function productMutationInput(product?: SiigoProduct): ProductInput {
  return {
    code: product?.code ?? '', name: product?.name ?? '',
    account_group: Number(product?.account_group?.id ?? 0),
    type: 'Product',
    availability: { purchase: product?.internal?.availability?.purchase ?? true, sale: product?.internal?.availability?.sale ?? true, expense: product?.internal?.availability?.expense ?? false },
    composition: { kind: product?.internal?.composition?.kind ?? 'product', version: product?.internal?.composition?.version ?? 1,
      components: (product?.internal?.composition?.components ?? []).map(c => ({ ...c })) },
    active: product?.active ?? true, stock_control: product?.stock_control ?? false,
    tax_included: product?.tax_included ?? false,
    unit: (typeof product?.unit === 'string' ? product.unit : product?.unit?.code)?.trim() || 'H87',
    key: product?.key?.code ?? '',
    reference: product?.reference ?? '', description: product?.description ?? '',
    additional_fields: { barcode: product?.additional_fields?.barcode ?? '', brand: product?.additional_fields?.brand ?? '' },
    taxes: (product?.taxes ?? []).map(tax => ({ id: Number(tax.id) })),
    prices: (product?.prices ?? []).map(price => ({
      currency_code: price.currency_code ?? 'MXN',
      price_list: (price.price_list ?? []).map(item => ({ position: Number(item.position), value: Number(item.value) }))
    }))
  }
}
