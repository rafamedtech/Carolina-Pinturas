import type { Prisma } from '../../generated/prisma/client'
import type { SiigoCustomer, SiigoProduct } from '~/types/siigo'

type TransactionClient = Prisma.TransactionClient

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function optionalDate(value: string | null | undefined) {
  if (!value || value === 'null') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function customerDisplayName(customer: SiigoCustomer) {
  if (Array.isArray(customer.name)) {
    return customer.name.filter(Boolean).join(' ') || customer.rfc_id || customer.id
  }

  return String(customer.name || customer.rfc_id || customer.id)
}

export async function upsertSiigoCustomer(tx: TransactionClient, customer: SiigoCustomer) {
  const data = {
    name: jsonValue(customer.name || []),
    displayName: customerDisplayName(customer),
    personType: customer.person_type || null,
    type: customer.type || null,
    identification: customer.identification || null,
    rfcId: customer.rfc_id || null,
    fiscalRegime: customer.fiscal_regime || null,
    active: customer.active ?? null,
    addressStreet: customer.address?.street || null,
    addressInteriorNumber: customer.address?.interior_number || null,
    addressExteriorNumber: customer.address?.exterior_number || null,
    addressColony: customer.address?.colony || null,
    addressLocality: customer.address?.locality || null,
    addressCityName: customer.address?.city?.city_name || null,
    addressStateName: customer.address?.city?.state_name || null,
    addressPostalCode: customer.address?.postal_code || null,
    rawPayload: jsonValue(customer),
    syncedAt: new Date()
  }
  const phones = (customer.phones || []).map((phone, index) => ({
    position: index + 1,
    number: phone.number || null,
    rawPayload: jsonValue(phone)
  }))
  const contacts = (customer.contacts || []).map((contact, index) => ({
    position: index + 1,
    firstName: contact.first_name || null,
    lastName: contact.last_name || null,
    email: contact.email || null,
    phone: contact.phone?.number || null,
    rawPayload: jsonValue(contact)
  }))

  await tx.siigoCustomer.upsert({
    where: { id: customer.id },
    create: {
      id: customer.id,
      ...data,
      phones: { create: phones },
      contacts: { create: contacts }
    },
    update: {
      ...data,
      // Una escritura anidada conserva la sustitución atómica del snapshot y
      // evita cuatro round trips extra dentro de la transacción del pedido.
      phones: { deleteMany: {}, create: phones },
      contacts: { deleteMany: {}, create: contacts }
    }
  })
}

export async function upsertSiigoProduct(tx: TransactionClient, product: SiigoProduct) {
  const unit = product.unit && typeof product.unit === 'object' ? product.unit : undefined
  const data = {
    code: product.code,
    name: product.name,
    accountGroupId: typeof product.account_group?.id === 'number' ? product.account_group.id : null,
    accountGroupName: product.account_group?.name || null,
    type: product.type || null,
    stockControl: product.stock_control ?? null,
    active: product.active ?? null,
    taxIncluded: product.tax_included ?? null,
    unitCode: unit?.code || null,
    unitName: unit?.name || null,
    keyCode: product.key?.code || null,
    keyName: product.key?.name || null,
    reference: product.reference || null,
    description: product.description || null,
    barcode: product.additional_fields?.barcode || null,
    brand: product.additional_fields?.brand || null,
    availableQuantity: product.available_quantity == null ? null : String(product.available_quantity),
    siigoCreatedAt: optionalDate(product.metadata?.created),
    siigoUpdatedAt: optionalDate(product.metadata?.last_updated),
    rawPayload: jsonValue(product),
    syncedAt: new Date()
  }
  const prices = (product.prices || []).flatMap(price =>
    (price.price_list || []).flatMap((item) => {
      const value = Number(item.value)
      if (!Number.isFinite(value) || item.position == null) return []

      return [{
        currencyCode: price.currency_code || 'MXN',
        position: item.position,
        name: item.name || null,
        value: String(value),
        rawPayload: jsonValue({
          currency_code: price.currency_code,
          ...item
        })
      }]
    })
  )
  const taxes = (product.taxes || []).flatMap((tax) => {
    if (typeof tax.id !== 'number') return []
    return [{
      siigoTaxId: tax.id,
      name: tax.name || null,
      type: tax.type || null,
      percentage: tax.percentage == null ? null : String(tax.percentage),
      rawPayload: jsonValue(tax)
    }]
  })
  const warehouses = (product.warehouses || []).flatMap((warehouse) => {
    if (typeof warehouse.id !== 'number') return []
    return [{
      siigoWarehouseId: warehouse.id,
      name: warehouse.name || null,
      quantity: warehouse.quantity == null ? null : String(warehouse.quantity),
      rawPayload: jsonValue(warehouse)
    }]
  })
  const components = (product.components || []).map(component => ({
    siigoComponentId: component.id == null ? null : String(component.id),
    name: component.name || null,
    quantity: component.quantity == null ? null : String(component.quantity),
    rawPayload: jsonValue(component)
  }))

  await tx.siigoProduct.upsert({
    where: { id: product.id },
    create: {
      id: product.id,
      ...data,
      prices: { create: prices },
      taxes: { create: taxes },
      warehouses: { create: warehouses },
      components: { create: components }
    },
    update: {
      ...data,
      // Siigo devuelve snapshots completos. Sustituir las relaciones en el
      // mismo upsert reduce hasta nueve llamadas Prisma por producto a una
      // sola escritura anidada y mantiene todo el snapshot atómico.
      prices: { deleteMany: {}, create: prices },
      taxes: { deleteMany: {}, create: taxes },
      warehouses: { deleteMany: {}, create: warehouses },
      components: { deleteMany: {}, create: components }
    }
  })
}

export function siigoJson(value: unknown) {
  return jsonValue(value)
}

export function siigoCustomerDisplayName(customer: SiigoCustomer) {
  return customerDisplayName(customer)
}
