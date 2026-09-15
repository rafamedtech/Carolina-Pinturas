import type { SiigoProduct } from '~/types/siigo'
import type { ProductInput } from '~/types/siigo-products'

export function productMutationInput(product?: SiigoProduct): ProductInput {
  return {
    code: product?.code ?? '', name: product?.name ?? '',
    account_group: Number(product?.account_group?.id ?? 0),
    type: (product?.type ?? 'Product') as ProductInput['type'],
    active: product?.active ?? true, stock_control: product?.stock_control ?? false,
    tax_included: product?.tax_included ?? false,
    unit: typeof product?.unit === 'string' ? product.unit : product?.unit?.code ?? '',
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
