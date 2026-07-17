import Decimal from 'decimal.js'
import type { Prisma, SalesOrder } from '../../generated/prisma/client'
import type { AppUser, SiigoCustomer, SiigoProduct } from '~/types/siigo'
import type { SalesOrderDetail, SalesOrderListItem } from '~/types/orders'
import type {
  CreateOrderInput,
  UpdateQuoteInput,
  UpdateOrderRemisionInput,
  UpdateOrderPaymentInput,
  UpdateOrderRepartidorInput,
  UpdateOrderTagsInput,
  UpdateOrderStatusInput,
  UpdateOrderItemPriceInput
} from './order-validation'
import { STATUS_KEYS_REQUIRING_REPARTIDOR } from './order-validation'
import { usePrisma } from './prisma'
import {
  canEditOrderRemision,
  canManageOrderLogistics,
  editableOrderStatusKeys
} from '~/utils/roleAccess'
import { resolveCreatedOrderStatusKey } from '~/utils/orderCreation'
import {
  siigoCustomerDisplayName,
  siigoJson,
  upsertSiigoCustomer,
  upsertSiigoProduct
} from './siigo-persistence'

const orderDetailInclude = {
  status: true,
  customer: true,
  items: {
    orderBy: { position: 'asc' },
    include: {
      priceHistory: {
        orderBy: { changedAt: 'asc' }
      }
    }
  },
  statusHistory: {
    include: {
      fromStatus: true,
      toStatus: true
    },
    orderBy: { changedAt: 'asc' }
  }
} satisfies Prisma.SalesOrderInclude

type OrderDetailRecord = Prisma.SalesOrderGetPayload<{ include: typeof orderDetailInclude }>

// Prisma cancela las transacciones interactivas después de 5 s por defecto.
// La app sincroniza snapshots de Siigo antes de escribir el pedido y la
// latencia del pooler de producción puede superar ese umbral aun con queries
// pequeñas. Mantener un límite explícito y acotado después de reducir los
// round trips de persistencia.
const ORDER_WRITE_TRANSACTION_OPTIONS = {
  maxWait: 5_000,
  timeout: 15_000
} as const

function money(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(6)
}

function number(value: { toString(): string } | number) {
  return Number(value.toString())
}

function dateOnly(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null
}

function orderTaxBreakdown(order: OrderDetailRecord): SalesOrderDetail['taxBreakdown'] {
  const breakdown = new Map<string, {
    name: string
    percentage: number | null
    amount: Decimal
  }>()

  for (const item of order.items) {
    const taxes = Array.isArray(item.taxPayload)
      ? item.taxPayload.flatMap((tax) => {
          if (!tax || typeof tax !== 'object' || Array.isArray(tax)) return []

          const percentage = Number(tax.percentage)
          if (!Number.isFinite(percentage) || percentage <= 0) return []

          const name = typeof tax.name === 'string' && tax.name.trim()
            ? tax.name.trim()
            : typeof tax.type === 'string' && tax.type.trim()
              ? tax.type.trim()
              : 'Impuesto'

          return [{ name, percentage }]
        })
      : []
    const itemTaxAmount = money(item.taxAmount)
    const combinedPercentage = taxes.reduce(
      (total, tax) => total.plus(tax.percentage),
      money(0)
    )

    if (!taxes.length || combinedPercentage.isZero()) {
      if (!itemTaxAmount.isZero()) {
        const current = breakdown.get('Impuestos|')
        breakdown.set('Impuestos|', {
          name: 'Impuestos',
          percentage: null,
          amount: (current?.amount || money(0)).plus(itemTaxAmount)
        })
      }
      continue
    }

    for (const tax of taxes) {
      const key = `${tax.name}|${tax.percentage}`
      const current = breakdown.get(key)
      const amount = itemTaxAmount.mul(tax.percentage).div(combinedPercentage)
      breakdown.set(key, {
        name: tax.name,
        percentage: tax.percentage,
        amount: (current?.amount || money(0)).plus(amount)
      })
    }
  }

  return [...breakdown.values()].map(tax => ({
    name: tax.name,
    percentage: tax.percentage,
    amount: number(tax.amount)
  }))
}

export function orderNumber(folio: number) {
  return `PED-${String(folio).padStart(6, '0')}`
}

function productPrice(product: SiigoProduct) {
  const price = product.prices?.find(item =>
    item.currency_code === 'MXN' && item.price_list?.some(entry => entry.position === 1)
  ) ?? product.prices?.find(item => item.price_list?.some(entry => entry.position === 1))
  ?? product.prices?.[0]
  const entry = price?.price_list?.find(item => item.position === 1) ?? price?.price_list?.[0]
  const value = Number(entry?.value ?? product.price ?? 0)

  return {
    currencyCode: price?.currency_code || 'MXN',
    value: Number.isFinite(value) ? money(value) : money(0)
  }
}

function discountOf(base: Decimal, discountType: string, discountValue: Decimal.Value) {
  return discountType === 'monto'
    ? money(Decimal.min(money(discountValue), base))
    : money(base.mul(discountValue).div(100))
}

// El descuento de la partida se aplica sobre la base sin impuestos; el
// impuesto se calcula sobre la base ya descontada. `subtotal` conserva la
// base bruta, de modo que total = subtotal - descuento + impuestos.
function lineAmounts(
  quantity: Decimal,
  unitPrice: Decimal,
  taxPercentage: Decimal,
  taxIncluded: boolean,
  discountType = 'porcentaje',
  discountValue: Decimal.Value = 0
) {
  const listedTotal = money(quantity.mul(unitPrice))
  const divisor = money(1).plus(taxPercentage.div(100))
  const subtotal = taxIncluded && taxPercentage.gt(0)
    ? money(listedTotal.div(divisor))
    : listedTotal
  const discountAmount = discountOf(subtotal, discountType, discountValue)
  const taxableBase = money(subtotal.minus(discountAmount))
  const taxAmount = money(taxableBase.mul(taxPercentage).div(100))
  const total = money(taxableBase.plus(taxAmount))

  return { subtotal, discountAmount, taxAmount, total }
}

// El descuento del pedido se aplica sobre la suma de partidas ya con
// impuestos; discount_total acumula descuentos de partidas + del pedido.
function orderTotals(
  lines: { subtotal: Decimal.Value, discountAmount: Decimal.Value, taxAmount: Decimal.Value, total: Decimal.Value }[],
  discountType: string,
  discountValue: Decimal.Value
) {
  const subtotal = lines.reduce((sum, line) => sum.plus(line.subtotal), money(0))
  const lineDiscounts = lines.reduce((sum, line) => sum.plus(line.discountAmount), money(0))
  const taxTotal = lines.reduce((sum, line) => sum.plus(line.taxAmount), money(0))
  const linesTotal = lines.reduce((sum, line) => sum.plus(line.total), money(0))
  const discountAmount = discountOf(linesTotal, discountType, discountValue)

  return {
    subtotal,
    taxTotal,
    discountAmount,
    discountTotal: money(lineDiscounts.plus(discountAmount)),
    total: money(linesTotal.minus(discountAmount))
  }
}

function taxPercentageFromPayload(taxPayload: Prisma.JsonValue): Decimal {
  const taxes = Array.isArray(taxPayload) ? taxPayload : []
  return taxes.reduce((sum: Decimal, tax) => {
    if (!tax || typeof tax !== 'object' || Array.isArray(tax)) return sum
    const percentage = Number((tax as { percentage?: unknown }).percentage)
    return Number.isFinite(percentage) ? sum.plus(percentage) : sum
  }, money(0))
}

function buildLine(
  product: SiigoProduct,
  line: {
    quantity: number
    unitPrice?: number | null
    priceNote?: string | null
    observations?: string | null
    discountType: string
    discountValue: number
  },
  position: number
) {
  const quantity = money(line.quantity)
  const selectedPrice = productPrice(product)
  // El precio editado en el editor sustituye al de lista de Siigo; el cambio
  // queda auditado en sales_order_item_price_history al guardar.
  const unitPrice = line.unitPrice != null ? money(line.unitPrice) : selectedPrice.value
  const priceOverridden = !unitPrice.equals(selectedPrice.value)
  const percentage = money((product.taxes || []).reduce((sum, tax) =>
    sum + (Number(tax.percentage) || 0), 0))
  const { subtotal, discountAmount, taxAmount, total } = lineAmounts(
    quantity,
    unitPrice,
    percentage,
    product.tax_included ?? false,
    line.discountType,
    line.discountValue
  )
  const unit = product.unit && typeof product.unit === 'object' ? product.unit : undefined

  return {
    position,
    productId: product.id,
    productCodeSnapshot: product.code,
    productNameSnapshot: product.name,
    productDescriptionSnapshot: product.description || null,
    productReferenceSnapshot: product.reference || null,
    unitCodeSnapshot: unit?.code || null,
    unitNameSnapshot: unit?.name || null,
    productPayload: siigoJson(product),
    quantity: quantity.toString(),
    unitPrice: unitPrice.toString(),
    taxIncluded: product.tax_included ?? false,
    discountType: line.discountType,
    discountValue: money(line.discountValue).toString(),
    discountPercentage: line.discountType === 'porcentaje' ? money(line.discountValue).toString() : '0',
    discountAmount: discountAmount.toString(),
    taxPayload: siigoJson(product.taxes || []),
    subtotal: subtotal.toString(),
    taxAmount: taxAmount.toString(),
    total: total.toString(),
    observations: line.observations || null,
    currencyCode: selectedPrice.currencyCode,
    catalogPrice: selectedPrice.value.toString(),
    priceNote: line.priceNote || null,
    priceOverridden
  }
}

type BuiltLine = ReturnType<typeof buildLine>

function assertLinePricePermission(lines: BuiltLine[], user: AppUser) {
  if (lines.some(line => line.priceOverridden) && !canManageOrderLogistics(user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No tienes permiso para modificar el precio de las partidas.'
    })
  }
}

// createMany no devuelve ids: se recuperan por posición para ligar el
// historial de precio de las partidas con precio editado.
async function createLinePriceHistory(
  tx: Prisma.TransactionClient,
  orderId: string,
  lines: BuiltLine[],
  user: AppUser
) {
  const overriddenLines = lines.filter(line => line.priceOverridden)
  if (!overriddenLines.length) return

  const createdItems = await tx.salesOrderItem.findMany({
    where: { orderId },
    select: { id: true, position: true }
  })
  const itemIdByPosition = new Map(createdItems.map(item => [item.position, item.id]))

  await tx.salesOrderItemPriceHistory.createMany({
    data: overriddenLines.flatMap((line) => {
      const orderItemId = itemIdByPosition.get(line.position)
      if (!orderItemId) return []

      return [{
        orderItemId,
        orderId,
        previousPrice: line.catalogPrice,
        newPrice: line.unitPrice,
        note: line.priceNote,
        changedByName: user.name,
        changedByEmail: user.email,
        changedByRole: user.role
      }]
    })
  })
}

const IGUALACION_MATCH = 'igualacion de color'
const IGUALACION_CODE_PREFIX = 'bi-'
const IGUALACION_STATUS_KEYS = ['confirmado', 'surtido', 'en_espera']
const igualacionFilter = {
  items: {
    some: {
      OR: [
        { productCodeSnapshot: { contains: IGUALACION_MATCH, mode: 'insensitive' as const } },
        { productNameSnapshot: { contains: IGUALACION_MATCH, mode: 'insensitive' as const } },
        { productCodeSnapshot: { startsWith: IGUALACION_CODE_PREFIX, mode: 'insensitive' as const } }
      ]
    }
  }
} satisfies Prisma.SalesOrderWhereInput

function isIgualacionItem(item: { productCodeSnapshot: string, productNameSnapshot: string }) {
  const code = item.productCodeSnapshot.toLowerCase()

  return code.includes(IGUALACION_MATCH)
    || item.productNameSnapshot.toLowerCase().includes(IGUALACION_MATCH)
    || code.startsWith(IGUALACION_CODE_PREFIX)
}

function orderVisibilityFilter(user: AppUser): Prisma.SalesOrderWhereInput {
  if (user.role === 'igualaciones') return igualacionFilter

  if (user.role === 'repartidor') {
    return {
      OR: [
        ...(user.repartidorId ? [{ repartidorId: user.repartidorId }] : []),
        { vendedorEmail: { equals: user.email, mode: 'insensitive' } }
      ]
    }
  }

  return {}
}

function assertStatusPermission(user: AppUser, statusKey: string) {
  const editableStatusKeys = editableOrderStatusKeys(user.role)

  if (editableStatusKeys && !editableStatusKeys.includes(statusKey)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No tienes permiso para asignar ese estado al pedido.'
    })
  }
}

function listItem(order: SalesOrder & {
  status: { key: string, label: string, color: string, sortOrder: number, isTerminal: boolean }
  _count: { items: number }
  items?: { productCodeSnapshot: string, productNameSnapshot: string, quantity: Prisma.Decimal, observations: string | null }[]
}): SalesOrderListItem {
  return {
    id: order.id,
    folio: order.folio,
    number: orderNumber(order.folio),
    status: {
      key: order.status.key,
      label: order.status.label,
      color: order.status.color,
      sortOrder: order.status.sortOrder,
      isTerminal: order.status.isTerminal
    },
    customer: {
      id: order.customerId,
      name: order.customerNameSnapshot,
      rfc: order.customerRfcSnapshot
    },
    orderDate: dateOnly(order.orderDate) || '',
    promisedDate: dateOnly(order.promisedDate),
    total: number(order.total),
    itemCount: order._count.items,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    ...(order.items
      ? {
          partidas: order.items.map(item => ({
            code: item.productCodeSnapshot,
            name: item.productNameSnapshot,
            quantity: number(item.quantity),
            observations: item.observations,
            isIgualacion: isIgualacionItem(item)
          }))
        }
      : {}),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString()
  }
}

// Phone and address live only in the customer snapshot JSON; the ticket and
// detail views surface them without widening the snapshot columns.
function customerContact(payload: Prisma.JsonValue): { phone: string | null, address: string | null } {
  const customer = payload as Partial<SiigoCustomer> | null
  if (!customer || typeof customer !== 'object') return { phone: null, address: null }

  const phone = customer.phones?.map(entry => entry.number?.trim()).find(Boolean) || null

  const address = customer.address
  const street = [address?.street, address?.exterior_number].filter(Boolean).join(' ')
  const interior = address?.interior_number ? `Int. ${address.interior_number}` : ''
  const colony = address?.colony ? `Col. ${address.colony}` : ''
  const postal = address?.postal_code ? `C.P. ${address.postal_code}` : ''
  const city = [address?.city?.city_name, address?.city?.state_name].filter(Boolean).join(', ')
  const line = [street, interior, colony, postal, city].filter(Boolean).join(', ')

  return { phone, address: line || null }
}

function detail(order: OrderDetailRecord): SalesOrderDetail {
  const base = listItem({ ...order, _count: { items: order.items.length } })

  return {
    ...base,
    customer: { ...base.customer, ...customerContact(order.customerPayload) },
    observations: order.observations,
    remision: order.remision,
    requiresInvoice: order.requiresInvoice,
    tags: order.tags,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    paymentDate: dateOnly(order.paymentDate),
    currencyCode: order.currencyCode,
    subtotal: number(order.subtotal),
    discountType: order.discountType === 'monto' ? 'monto' : 'porcentaje',
    discountValue: number(order.discountValue),
    discountAmount: number(order.discountAmount),
    discountTotal: number(order.discountTotal),
    taxTotal: number(order.taxTotal),
    taxBreakdown: orderTaxBreakdown(order),
    siigoReference: order.siigoReference,
    registeredInSiigoAt: order.registeredInSiigoAt?.toISOString() || null,
    version: order.version,
    vendedor: {
      name: order.vendedorNombre,
      email: order.vendedorEmail
    },
    repartidor: order.repartidorId
      ? {
          id: order.repartidorId,
          name: order.repartidorNombreSnapshot ?? '',
          telefono: order.repartidorTelefonoSnapshot
        }
      : null,
    createdBy: {
      name: order.createdByName,
      email: order.createdByEmail,
      role: order.createdByRole
    },
    items: order.items.map(item => ({
      id: item.id,
      position: item.position,
      productId: item.productId,
      code: item.productCodeSnapshot,
      name: item.productNameSnapshot,
      description: item.productDescriptionSnapshot,
      reference: item.productReferenceSnapshot,
      unit: {
        code: item.unitCodeSnapshot,
        name: item.unitNameSnapshot
      },
      quantity: number(item.quantity),
      unitPrice: number(item.unitPrice),
      discountType: item.discountType === 'monto' ? 'monto' : 'porcentaje',
      discountValue: number(item.discountValue),
      discountPercentage: number(item.discountPercentage),
      discountAmount: number(item.discountAmount),
      subtotal: number(item.subtotal),
      taxAmount: number(item.taxAmount),
      total: number(item.total),
      observations: item.observations,
      priceHistory: item.priceHistory.map(entry => ({
        id: entry.id.toString(),
        previousPrice: number(entry.previousPrice),
        newPrice: number(entry.newPrice),
        note: entry.note,
        changedBy: {
          name: entry.changedByName,
          email: entry.changedByEmail,
          role: entry.changedByRole
        },
        changedAt: entry.changedAt.toISOString()
      }))
    })),
    statusHistory: order.statusHistory.map(history => ({
      id: history.id.toString(),
      fromStatus: history.fromStatus
        ? { key: history.fromStatus.key, label: history.fromStatus.label }
        : null,
      toStatus: {
        key: history.toStatus.key,
        label: history.toStatus.label
      },
      note: history.note,
      changedBy: {
        name: history.changedByName,
        email: history.changedByEmail,
        role: history.changedByRole
      },
      changedAt: history.changedAt.toISOString()
    }))
  }
}

export async function createOrder(
  input: CreateOrderInput,
  user: AppUser,
  customer: SiigoCustomer,
  products: Map<string, SiigoProduct>,
  repartidor: {
    id: string
    nombre: string
    telefono: string | null
    esMostrador: boolean
  } | null
) {
  const prisma = usePrisma()
  const lines = input.lines.map((line, index) => {
    const product = products.get(line.productId)
    if (!product) {
      throw createError({
        statusCode: 422,
        statusMessage: `El producto ${line.productId} ya no está disponible en Siigo.`
      })
    }
    return buildLine(product, line, index + 1)
  })
  const currencyCodes = new Set(lines.map(line => line.currencyCode))
  if (currencyCodes.size > 1) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Todos los productos del pedido deben usar la misma moneda.'
    })
  }
  assertLinePricePermission(lines, user)
  const totals = orderTotals(lines, input.discountType, input.discountValue)
  const displayName = siigoCustomerDisplayName(customer)
  const statusKey = resolveCreatedOrderStatusKey(
    input.statusKey,
    repartidor?.esMostrador ?? false
  )

  const created = await prisma.$transaction(async (tx) => {
    const status = await tx.orderStatus.findFirst({
      where: { key: statusKey, isActive: true }
    })
    if (!status) {
      throw createError({ statusCode: 422, statusMessage: 'El estado seleccionado no está disponible.' })
    }

    await upsertSiigoCustomer(tx, customer)
    for (const product of products.values()) {
      await upsertSiigoProduct(tx, product)
    }

    const order = await tx.salesOrder.create({
      data: {
        statusKey: status.key,
        customerId: customer.id,
        customerNameSnapshot: displayName,
        customerRfcSnapshot: customer.rfc_id || customer.identification || null,
        customerPayload: siigoJson(customer),
        orderDate: new Date(`${input.orderDate}T00:00:00.000Z`),
        promisedDate: input.promisedDate
          ? new Date(`${input.promisedDate}T00:00:00.000Z`)
          : null,
        observations: input.observations || null,
        remision: input.remision || null,
        requiresInvoice: input.requiresInvoice,
        tags: input.tags,
        paymentStatus: input.paymentStatus,
        paymentMethod: input.paymentMethod ?? null,
        paymentDate: input.paymentDate ? new Date(`${input.paymentDate}T00:00:00.000Z`) : null,
        currencyCode: lines[0]?.currencyCode || 'MXN',
        subtotal: totals.subtotal.toString(),
        discountType: input.discountType,
        discountValue: money(input.discountValue).toString(),
        discountAmount: totals.discountAmount.toString(),
        discountTotal: totals.discountTotal.toString(),
        taxTotal: totals.taxTotal.toString(),
        total: totals.total.toString(),
        vendedorNombre: user.name,
        vendedorEmail: user.email,
        repartidorId: repartidor?.id ?? null,
        repartidorNombreSnapshot: repartidor?.nombre ?? null,
        repartidorTelefonoSnapshot: repartidor?.telefono ?? null,
        createdByName: user.name,
        createdByEmail: user.email,
        createdByRole: user.role,
        updatedByEmail: user.email
      }
    })
    await tx.salesOrderItem.createMany({
      data: lines.map(({ currencyCode: _currencyCode, catalogPrice: _catalogPrice, priceNote: _priceNote, priceOverridden: _priceOverridden, ...line }) => ({
        orderId: order.id,
        ...line
      }))
    })
    await createLinePriceHistory(tx, order.id, lines, user)
    await tx.salesOrderStatusHistory.create({
      data: {
        orderId: order.id,
        toStatusKey: status.key,
        note: status.key === 'borrador' ? 'Cotización creada.' : 'Pedido creado.',
        changedByName: user.name,
        changedByEmail: user.email,
        changedByRole: user.role
      }
    })

    return tx.salesOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: orderDetailInclude
    })
  }, ORDER_WRITE_TRANSACTION_OPTIONS)

  return detail(created)
}

export async function updateQuote(
  id: string,
  input: UpdateQuoteInput,
  user: AppUser,
  customer: SiigoCustomer,
  products: Map<string, SiigoProduct>
) {
  const prisma = usePrisma()
  const existing = await prisma.salesOrder.findFirst({
    where: {
      id,
      AND: [orderVisibilityFilter(user)]
    },
    select: { statusKey: true }
  })

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'No se encontró la cotización.' })
  }
  if (existing.statusKey !== 'borrador') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Sólo se pueden editar documentos que siguen siendo cotizaciones.'
    })
  }

  const lines = input.lines.map((line, index) => {
    const product = products.get(line.productId)
    if (!product) {
      throw createError({
        statusCode: 422,
        statusMessage: `El producto ${line.productId} ya no está disponible en Siigo.`
      })
    }
    return buildLine(product, line, index + 1)
  })
  const currencyCodes = new Set(lines.map(line => line.currencyCode))
  if (currencyCodes.size > 1) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Todos los productos de la cotización deben usar la misma moneda.'
    })
  }

  assertLinePricePermission(lines, user)
  const totals = orderTotals(lines, input.discountType, input.discountValue)
  const displayName = siigoCustomerDisplayName(customer)

  const updated = await prisma.$transaction(async (tx) => {
    await upsertSiigoCustomer(tx, customer)
    for (const product of products.values()) {
      await upsertSiigoProduct(tx, product)
    }

    const result = await tx.salesOrder.updateMany({
      where: { id, version: input.version, statusKey: 'borrador' },
      data: {
        customerId: customer.id,
        customerNameSnapshot: displayName,
        customerRfcSnapshot: customer.rfc_id || customer.identification || null,
        customerPayload: siigoJson(customer),
        orderDate: new Date(`${input.orderDate}T00:00:00.000Z`),
        observations: input.observations || null,
        tags: input.tags,
        currencyCode: lines[0]?.currencyCode || 'MXN',
        subtotal: totals.subtotal.toString(),
        discountType: input.discountType,
        discountValue: money(input.discountValue).toString(),
        discountAmount: totals.discountAmount.toString(),
        discountTotal: totals.discountTotal.toString(),
        taxTotal: totals.taxTotal.toString(),
        total: totals.total.toString(),
        updatedByEmail: user.email,
        version: { increment: 1 }
      }
    })
    if (result.count !== 1) {
      throw createError({
        statusCode: 409,
        statusMessage: 'La cotización cambió mientras la editabas. Recarga e intenta de nuevo.'
      })
    }

    await tx.salesOrderItem.deleteMany({ where: { orderId: id } })
    await tx.salesOrderItem.createMany({
      data: lines.map(({ currencyCode: _currencyCode, catalogPrice: _catalogPrice, priceNote: _priceNote, priceOverridden: _priceOverridden, ...line }) => ({
        orderId: id,
        ...line
      }))
    })
    await createLinePriceHistory(tx, id, lines, user)
    await tx.salesOrderStatusHistory.create({
      data: {
        orderId: id,
        toStatusKey: 'borrador',
        note: 'Cotización actualizada.',
        changedByName: user.name,
        changedByEmail: user.email,
        changedByRole: user.role
      }
    })

    return tx.salesOrder.findUniqueOrThrow({
      where: { id },
      include: orderDetailInclude
    })
  }, ORDER_WRITE_TRANSACTION_OPTIONS)

  return detail(updated)
}

export async function getOrder(id: string, user: AppUser) {
  const order = await usePrisma().salesOrder.findFirst({
    where: {
      id,
      AND: [orderVisibilityFilter(user)]
    },
    include: orderDetailInclude
  })

  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'No se encontró el pedido.' })
  }

  return detail(order)
}

export async function listOrders(options: {
  page: number
  pageSize: number
  search?: string
  statusKey?: string
  paymentStatus?: string
  paymentMethod?: string
  dateFrom?: string
  dateTo?: string
  igualacion?: boolean
}, user: AppUser) {
  const prisma = usePrisma()
  const isIgualacionesView = options.igualacion || user.role === 'igualaciones'
  const folioMatch = options.search?.toUpperCase().match(/^(?:PED-?)?0*(\d+)$/)
  const folio = folioMatch?.[1] ? Number(folioMatch[1]) : null
  const statusFilter: Prisma.SalesOrderWhereInput = isIgualacionesView
    ? {
        statusKey: options.statusKey
          ? { in: IGUALACION_STATUS_KEYS.filter(key => key === options.statusKey) }
          : { in: IGUALACION_STATUS_KEYS }
      }
    : options.statusKey
      ? { statusKey: options.statusKey }
      : {}
  const paymentStatusFilter: Prisma.SalesOrderWhereInput = options.paymentStatus
    ? { paymentStatus: options.paymentStatus }
    : {}
  const paymentMethodFilter: Prisma.SalesOrderWhereInput = options.paymentMethod
    ? { paymentMethod: options.paymentMethod }
    : {}
  const dateFilter: Prisma.SalesOrderWhereInput = options.dateFrom || options.dateTo
    ? {
        orderDate: {
          ...(options.dateFrom ? { gte: new Date(`${options.dateFrom}T00:00:00.000Z`) } : {}),
          ...(options.dateTo
            ? { lt: new Date(new Date(`${options.dateTo}T00:00:00.000Z`).getTime() + 86_400_000) }
            : {})
        }
      }
    : {}
  const searchFilter: Prisma.SalesOrderWhereInput = options.search
    ? {
        OR: [{
          customerNameSnapshot: { contains: options.search, mode: 'insensitive' }
        }, {
          customerRfcSnapshot: { contains: options.search, mode: 'insensitive' }
        }, {
          observations: { contains: options.search, mode: 'insensitive' }
        }, {
          remision: { contains: options.search, mode: 'insensitive' }
        }, {
          vendedorNombre: { contains: options.search, mode: 'insensitive' }
        }, {
          vendedorEmail: { contains: options.search, mode: 'insensitive' }
        }, {
          repartidorNombreSnapshot: { contains: options.search, mode: 'insensitive' }
        }, ...(folio && Number.isSafeInteger(folio) ? [{ folio }] : [])]
      }
    : {}
  const where: Prisma.SalesOrderWhereInput = {
    AND: [
      statusFilter,
      paymentStatusFilter,
      paymentMethodFilter,
      dateFilter,
      orderVisibilityFilter(user),
      ...(isIgualacionesView ? [igualacionFilter] : []),
      searchFilter
    ]
  }
  const [orders, totalResults] = await prisma.$transaction([
    prisma.salesOrder.findMany({
      where,
      include: {
        status: true,
        _count: { select: { items: true } },
        ...(isIgualacionesView
          ? {
              items: {
                select: { productCodeSnapshot: true, productNameSnapshot: true, quantity: true, observations: true },
                orderBy: { position: 'asc' as const }
              }
            }
          : {})
      },
      orderBy: [{ orderDate: 'desc' }, { folio: 'desc' }],
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize
    }),
    prisma.salesOrder.count({ where })
  ])

  return {
    results: orders.map(listItem),
    pagination: {
      page: options.page,
      pageSize: options.pageSize,
      totalResults,
      totalPages: Math.ceil(totalResults / options.pageSize)
    }
  }
}

export async function updateOrderStatus(
  id: string,
  input: UpdateOrderStatusInput,
  user: AppUser
) {
  const prisma = usePrisma()
  assertStatusPermission(user, input.statusKey)

  await prisma.$transaction(async (tx) => {
    const order = await tx.salesOrder.findFirst({
      where: {
        id,
        AND: [orderVisibilityFilter(user)]
      },
      select: { statusKey: true, version: true, repartidorId: true }
    })
    const status = await tx.orderStatus.findFirst({
      where: { key: input.statusKey, isActive: true }
    })

    if (!order) {
      throw createError({ statusCode: 404, statusMessage: 'No se encontró el pedido.' })
    }
    if (!status) {
      throw createError({ statusCode: 422, statusMessage: 'El estado seleccionado no está disponible.' })
    }
    if (order.version !== input.version) {
      throw createError({
        statusCode: 409,
        statusMessage: 'El pedido cambió desde que lo abriste. Actualiza la página e intenta de nuevo.'
      })
    }
    if (STATUS_KEYS_REQUIRING_REPARTIDOR.includes(status.key) && !order.repartidorId) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Asigna un repartidor antes de confirmar el pedido.'
      })
    }
    if (order.statusKey === status.key) return

    const result = await tx.salesOrder.updateMany({
      where: { id, version: input.version },
      data: {
        statusKey: status.key,
        updatedByEmail: user.email,
        version: { increment: 1 }
      }
    })
    if (result.count !== 1) {
      throw createError({
        statusCode: 409,
        statusMessage: 'El pedido cambió mientras se actualizaba. Intenta de nuevo.'
      })
    }

    await tx.salesOrderStatusHistory.create({
      data: {
        orderId: id,
        fromStatusKey: order.statusKey,
        toStatusKey: status.key,
        note: input.note || null,
        changedByName: user.name,
        changedByEmail: user.email,
        changedByRole: user.role
      }
    })
  })

  return getOrder(id, user)
}

export async function updateOrderRemision(
  id: string,
  input: UpdateOrderRemisionInput,
  user: AppUser
) {
  const prisma = usePrisma()

  if (!canEditOrderRemision(user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No tienes permiso para modificar la remisión.'
    })
  }

  const order = await prisma.salesOrder.findFirst({
    where: {
      id,
      AND: [orderVisibilityFilter(user)]
    },
    select: { version: true }
  })

  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'No se encontró el pedido.' })
  }
  if (order.version !== input.version) {
    throw createError({
      statusCode: 409,
      statusMessage: 'El pedido cambió desde que lo abriste. Actualiza la página e intenta de nuevo.'
    })
  }

  const result = await prisma.salesOrder.updateMany({
    where: { id, version: input.version },
    data: {
      remision: input.remision || null,
      updatedByEmail: user.email,
      version: { increment: 1 }
    }
  })
  if (result.count !== 1) {
    throw createError({
      statusCode: 409,
      statusMessage: 'El pedido cambió mientras se actualizaba. Intenta de nuevo.'
    })
  }

  return getOrder(id, user)
}

export async function updateOrderPayment(
  id: string,
  input: UpdateOrderPaymentInput,
  user: AppUser
) {
  const prisma = usePrisma()

  if (!canManageOrderLogistics(user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No tienes permiso para modificar el pago.'
    })
  }

  const order = await prisma.salesOrder.findFirst({
    where: {
      id,
      AND: [orderVisibilityFilter(user)]
    },
    select: { version: true }
  })

  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'No se encontró el pedido.' })
  }
  if (order.version !== input.version) {
    throw createError({
      statusCode: 409,
      statusMessage: 'El pedido cambió desde que lo abriste. Actualiza la página e intenta de nuevo.'
    })
  }

  const result = await prisma.salesOrder.updateMany({
    where: { id, version: input.version },
    data: {
      paymentStatus: input.paymentStatus,
      paymentMethod: input.paymentMethod ?? null,
      updatedByEmail: user.email,
      version: { increment: 1 }
    }
  })
  if (result.count !== 1) {
    throw createError({
      statusCode: 409,
      statusMessage: 'El pedido cambió mientras se actualizaba. Intenta de nuevo.'
    })
  }

  return getOrder(id, user)
}

export async function updateOrderRepartidor(
  id: string,
  input: UpdateOrderRepartidorInput,
  user: AppUser
) {
  const prisma = usePrisma()

  if (!canManageOrderLogistics(user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No tienes permiso para reasignar el repartidor.'
    })
  }

  const [order, repartidor] = await Promise.all([
    prisma.salesOrder.findFirst({
      where: {
        id,
        AND: [orderVisibilityFilter(user)]
      },
      select: { version: true }
    }),
    prisma.repartidor.findUnique({ where: { id: input.repartidorId } })
  ])

  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'No se encontró el pedido.' })
  }
  if (!repartidor) {
    throw createError({ statusCode: 422, statusMessage: 'El repartidor seleccionado no está disponible.' })
  }
  if (order.version !== input.version) {
    throw createError({
      statusCode: 409,
      statusMessage: 'El pedido cambió desde que lo abriste. Actualiza la página e intenta de nuevo.'
    })
  }

  const result = await prisma.salesOrder.updateMany({
    where: { id, version: input.version },
    data: {
      repartidorId: repartidor.id,
      repartidorNombreSnapshot: repartidor.nombre,
      repartidorTelefonoSnapshot: repartidor.telefono,
      updatedByEmail: user.email,
      version: { increment: 1 }
    }
  })
  if (result.count !== 1) {
    throw createError({
      statusCode: 409,
      statusMessage: 'El pedido cambió mientras se actualizaba. Intenta de nuevo.'
    })
  }

  return getOrder(id, user)
}

export async function updateOrderTags(
  id: string,
  input: UpdateOrderTagsInput,
  user: AppUser
) {
  const prisma = usePrisma()

  if (!canManageOrderLogistics(user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No tienes permiso para modificar las etiquetas.'
    })
  }

  const order = await prisma.salesOrder.findFirst({
    where: {
      id,
      AND: [orderVisibilityFilter(user)]
    },
    select: { version: true }
  })

  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'No se encontró el pedido.' })
  }
  if (order.version !== input.version) {
    throw createError({
      statusCode: 409,
      statusMessage: 'El pedido cambió desde que lo abriste. Actualiza la página e intenta de nuevo.'
    })
  }

  const result = await prisma.salesOrder.updateMany({
    where: { id, version: input.version },
    data: {
      tags: input.tags,
      updatedByEmail: user.email,
      version: { increment: 1 }
    }
  })
  if (result.count !== 1) {
    throw createError({
      statusCode: 409,
      statusMessage: 'El pedido cambió mientras se actualizaba. Intenta de nuevo.'
    })
  }

  return getOrder(id, user)
}

export async function updateOrderItemPrice(
  orderId: string,
  itemId: string,
  input: UpdateOrderItemPriceInput,
  user: AppUser
) {
  const prisma = usePrisma()

  if (!canManageOrderLogistics(user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No tienes permiso para modificar el precio de esta partida.'
    })
  }

  const order = await prisma.salesOrder.findFirst({
    where: {
      id: orderId,
      AND: [orderVisibilityFilter(user)]
    },
    select: { statusKey: true, version: true, discountType: true, discountValue: true }
  })
  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'No se encontró el pedido.' })
  }
  // Cotizaciones (borrador) se editan completas desde el editor, que vuelve a
  // consultar Siigo y recrea las partidas: un ajuste puntual aquí se perdería
  // en el siguiente guardado sin dejar rastro.
  if (order.statusKey === 'borrador') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Edita el precio desde la cotización mientras sigue siendo un borrador.'
    })
  }
  if (order.version !== input.version) {
    throw createError({
      statusCode: 409,
      statusMessage: 'El pedido cambió desde que lo abriste. Actualiza la página e intenta de nuevo.'
    })
  }

  const item = await prisma.salesOrderItem.findFirst({ where: { id: itemId, orderId } })
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'No se encontró la partida.' })
  }

  const previousPrice = money(item.unitPrice)
  const newPrice = money(input.unitPrice)
  if (previousPrice.equals(newPrice)) {
    throw createError({
      statusCode: 422,
      statusMessage: 'El precio nuevo debe ser diferente al actual.'
    })
  }

  const quantity = money(item.quantity)
  const taxPercentage = taxPercentageFromPayload(item.taxPayload)
  const { subtotal, discountAmount, taxAmount, total } = lineAmounts(
    quantity,
    newPrice,
    taxPercentage,
    item.taxIncluded,
    item.discountType,
    item.discountValue
  )

  await prisma.$transaction(async (tx) => {
    await tx.salesOrderItem.update({
      where: { id: itemId },
      data: {
        unitPrice: newPrice.toString(),
        subtotal: subtotal.toString(),
        discountAmount: discountAmount.toString(),
        taxAmount: taxAmount.toString(),
        total: total.toString()
      }
    })
    await tx.salesOrderItemPriceHistory.create({
      data: {
        orderItemId: itemId,
        orderId,
        previousPrice: previousPrice.toString(),
        newPrice: newPrice.toString(),
        note: input.note || null,
        changedByName: user.name,
        changedByEmail: user.email,
        changedByRole: user.role
      }
    })

    const items = await tx.salesOrderItem.findMany({ where: { orderId } })
    const totals = orderTotals(items.map(current => ({
      subtotal: current.subtotal.toString(),
      discountAmount: current.discountAmount.toString(),
      taxAmount: current.taxAmount.toString(),
      total: current.total.toString()
    })), order.discountType, order.discountValue.toString())

    const result = await tx.salesOrder.updateMany({
      where: { id: orderId, version: input.version },
      data: {
        subtotal: totals.subtotal.toString(),
        discountAmount: totals.discountAmount.toString(),
        discountTotal: totals.discountTotal.toString(),
        taxTotal: totals.taxTotal.toString(),
        total: totals.total.toString(),
        updatedByEmail: user.email,
        version: { increment: 1 }
      }
    })
    if (result.count !== 1) {
      throw createError({
        statusCode: 409,
        statusMessage: 'El pedido cambió mientras se actualizaba. Intenta de nuevo.'
      })
    }
  })

  return getOrder(orderId, user)
}
