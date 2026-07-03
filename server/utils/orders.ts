import Decimal from 'decimal.js'
import type { Prisma, SalesOrder } from '../../generated/prisma/client'
import type { AppUser, SiigoCustomer, SiigoProduct } from '~/types/siigo'
import type { SalesOrderDetail, SalesOrderListItem } from '~/types/orders'
import type {
  CreateOrderInput,
  UpdateOrderRemisionInput,
  UpdateOrderRepartidorInput,
  UpdateOrderStatusInput
} from './order-validation'
import { STATUS_KEYS_REQUIRING_REPARTIDOR } from './order-validation'
import { usePrisma } from './prisma'
import {
  canEditOrderRemision,
  canManageOrderLogistics,
  editableOrderStatusKeys
} from '~/utils/roleAccess'
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
    orderBy: { position: 'asc' }
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

function buildLine(
  product: SiigoProduct,
  quantityValue: number,
  position: number,
  observations?: string | null
) {
  const quantity = money(quantityValue)
  const selectedPrice = productPrice(product)
  const percentage = money((product.taxes || []).reduce((sum, tax) =>
    sum + (Number(tax.percentage) || 0), 0))
  const listedTotal = money(quantity.mul(selectedPrice.value))
  const divisor = money(1).plus(percentage.div(100))
  const subtotal = product.tax_included && percentage.gt(0)
    ? money(listedTotal.div(divisor))
    : listedTotal
  const taxAmount = product.tax_included
    ? money(listedTotal.minus(subtotal))
    : money(subtotal.mul(percentage).div(100))
  const total = product.tax_included
    ? listedTotal
    : money(subtotal.plus(taxAmount))
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
    unitPrice: selectedPrice.value.toString(),
    discountPercentage: '0',
    discountAmount: '0',
    taxPayload: siigoJson(product.taxes || []),
    subtotal: subtotal.toString(),
    taxAmount: taxAmount.toString(),
    total: total.toString(),
    observations: observations || null,
    currencyCode: selectedPrice.currencyCode
  }
}

const IGUALACION_MATCH = 'igualacion de color'
const IGUALACION_STATUS_KEYS = ['confirmado', 'surtido', 'en_espera']
const igualacionFilter = {
  items: {
    some: {
      OR: [
        { productCodeSnapshot: { contains: IGUALACION_MATCH, mode: 'insensitive' as const } },
        { productNameSnapshot: { contains: IGUALACION_MATCH, mode: 'insensitive' as const } }
      ]
    }
  }
} satisfies Prisma.SalesOrderWhereInput

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
    ...(order.items
      ? {
          partidas: order.items.map(item => ({
            code: item.productCodeSnapshot,
            name: item.productNameSnapshot,
            quantity: number(item.quantity),
            observations: item.observations,
            isIgualacion:
              item.productCodeSnapshot.toLowerCase().includes(IGUALACION_MATCH)
              || item.productNameSnapshot.toLowerCase().includes(IGUALACION_MATCH)
          }))
        }
      : {}),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString()
  }
}

function detail(order: OrderDetailRecord): SalesOrderDetail {
  const base = listItem({ ...order, _count: { items: order.items.length } })

  return {
    ...base,
    observations: order.observations,
    remision: order.remision,
    currencyCode: order.currencyCode,
    subtotal: number(order.subtotal),
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
      discountPercentage: number(item.discountPercentage),
      discountAmount: number(item.discountAmount),
      subtotal: number(item.subtotal),
      taxAmount: number(item.taxAmount),
      total: number(item.total),
      observations: item.observations
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
  repartidor: { id: string, nombre: string, telefono: string | null } | null
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
    return buildLine(product, line.quantity, index + 1, line.observations)
  })
  const currencyCodes = new Set(lines.map(line => line.currencyCode))
  if (currencyCodes.size > 1) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Todos los productos del pedido deben usar la misma moneda.'
    })
  }
  const subtotal = lines.reduce((sum, line) => sum.plus(line.subtotal), money(0))
  const discountTotal = lines.reduce((sum, line) => sum.plus(line.discountAmount), money(0))
  const taxTotal = lines.reduce((sum, line) => sum.plus(line.taxAmount), money(0))
  const total = lines.reduce((sum, line) => sum.plus(line.total), money(0))
  const displayName = siigoCustomerDisplayName(customer)

  const created = await prisma.$transaction(async (tx) => {
    const status = await tx.orderStatus.findFirst({
      where: { key: input.statusKey, isActive: true }
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
        currencyCode: lines[0]?.currencyCode || 'MXN',
        subtotal: subtotal.toString(),
        discountTotal: discountTotal.toString(),
        taxTotal: taxTotal.toString(),
        total: total.toString(),
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
      data: lines.map(({ currencyCode: _currencyCode, ...line }) => ({
        orderId: order.id,
        ...line
      }))
    })
    await tx.salesOrderStatusHistory.create({
      data: {
        orderId: order.id,
        toStatusKey: status.key,
        note: 'Pedido creado.',
        changedByName: user.name,
        changedByEmail: user.email,
        changedByRole: user.role
      }
    })

    return tx.salesOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: orderDetailInclude
    })
  })

  return detail(created)
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
