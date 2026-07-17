import type { Prisma } from '../../../generated/prisma/client'
import type {
  DashboardBreakdownItem,
  DashboardTopProduct,
  SalesDashboardSummary
} from '~/types/dashboard'
import { PAYMENT_STATUSES } from '~/utils/orderPayment'
import { orderStatusBadgeColor } from '~/utils/orderStatus'
import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import { usePrisma } from '../../utils/prisma'

const EXCLUDED_SALES_STATUSES = ['borrador', 'cancelado']

function numeric(value: { toString(): string } | number | null | undefined) {
  return value == null ? 0 : Number(value.toString())
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10)
}

function monthBounds(now = new Date()) {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const start = new Date(Date.UTC(year, month, 1))
  const end = new Date(Date.UTC(year, month + 1, 1))
  const previousStart = new Date(Date.UTC(year, month - 1, 1))
  const elapsedDays = Math.min(now.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate())

  return { start, end, previousStart, elapsedDays }
}

function percentage(amount: number, total: number) {
  return total > 0 ? Math.round((amount / total) * 1000) / 10 : 0
}

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_LOGISTICS_ROLES)
  const prisma = usePrisma()
  const { start, end, previousStart, elapsedDays } = monthBounds()
  const salesWhere = {
    statusKey: { notIn: EXCLUDED_SALES_STATUSES },
    orderDate: { gte: start, lt: end }
  } satisfies Prisma.SalesOrderWhereInput

  const [orders, previous] = await prisma.$transaction([
    prisma.salesOrder.findMany({
      where: salesWhere,
      select: {
        id: true,
        folio: true,
        orderDate: true,
        total: true,
        customerNameSnapshot: true,
        paymentStatus: true,
        status: {
          select: { key: true, label: true, color: true, sortOrder: true }
        },
        items: {
          select: {
            productId: true,
            productCodeSnapshot: true,
            productNameSnapshot: true,
            quantity: true,
            total: true
          }
        }
      },
      orderBy: [{ orderDate: 'desc' }, { folio: 'desc' }]
    }),
    prisma.salesOrder.aggregate({
      where: {
        statusKey: { notIn: EXCLUDED_SALES_STATUSES },
        orderDate: { gte: previousStart, lt: start }
      },
      _sum: { total: true }
    })
  ])

  const sales = orders.reduce((sum, order) => sum + numeric(order.total), 0)
  const previousSales = numeric(previous._sum.total)
  const orderCount = orders.length
  const collectedAmount = orders
    .filter(order => order.paymentStatus === 'pago_recibido')
    .reduce((sum, order) => sum + numeric(order.total), 0)
  const pendingAmount = sales - collectedAmount
  const daysInMonth = Math.round((end.getTime() - start.getTime()) / 86_400_000)
  const dailyTotals = new Map<string, { total: number, orders: number }>()

  for (const order of orders) {
    const key = dateOnly(order.orderDate)
    const current = dailyTotals.get(key) || { total: 0, orders: 0 }
    current.total += numeric(order.total)
    current.orders += 1
    dailyTotals.set(key, current)
  }

  const dailySales = Array.from({ length: elapsedDays }, (_, index) => {
    const date = new Date(start.getTime() + index * 86_400_000)
    const key = dateOnly(date)
    const value = dailyTotals.get(key) || { total: 0, orders: 0 }

    return {
      date: key,
      label: new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date),
      ...value
    }
  })

  const paymentBreakdown: DashboardBreakdownItem[] = PAYMENT_STATUSES.map((payment) => {
    const matching = orders.filter(order => order.paymentStatus === payment.key)
    const amount = matching.reduce((sum, order) => sum + numeric(order.total), 0)

    return {
      key: payment.key,
      label: payment.label,
      color: payment.color,
      count: matching.length,
      amount,
      percentage: percentage(amount, sales)
    }
  }).filter(item => item.count > 0)

  const statuses = new Map<string, DashboardBreakdownItem & { sortOrder: number }>()
  for (const order of orders) {
    const current = statuses.get(order.status.key) || {
      key: order.status.key,
      label: order.status.label,
      color: orderStatusBadgeColor(order.status.color),
      count: 0,
      amount: 0,
      percentage: 0,
      sortOrder: order.status.sortOrder
    }
    current.count += 1
    current.amount += numeric(order.total)
    statuses.set(order.status.key, current)
  }
  const statusBreakdown = [...statuses.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ sortOrder: _sortOrder, ...item }) => ({
      ...item,
      percentage: percentage(item.count, orderCount)
    }))

  const products = new Map<string, Omit<DashboardTopProduct, 'percentage'>>()
  for (const order of orders) {
    for (const item of order.items) {
      const current = products.get(item.productId) || {
        productId: item.productId,
        code: item.productCodeSnapshot,
        name: item.productNameSnapshot,
        quantity: 0,
        amount: 0
      }
      current.quantity += numeric(item.quantity)
      current.amount += numeric(item.total)
      products.set(item.productId, current)
    }
  }
  const topProducts = [...products.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map(product => ({ ...product, percentage: percentage(product.amount, sales) }))

  const result: SalesDashboardSummary = {
    period: {
      label: new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(start),
      start: dateOnly(start),
      end: dateOnly(new Date(end.getTime() - 86_400_000)),
      elapsedDays,
      totalDays: daysInMonth
    },
    metrics: {
      sales,
      previousSales,
      salesChangePercentage: previousSales > 0
        ? Math.round(((sales - previousSales) / previousSales) * 1000) / 10
        : null,
      projectedSales: elapsedDays > 0 ? (sales / elapsedDays) * daysInMonth : 0,
      orderCount,
      averageTicket: orderCount > 0 ? sales / orderCount : 0,
      pendingAmount,
      collectedAmount
    },
    dailySales,
    paymentBreakdown,
    statusBreakdown,
    topProducts,
    recentOrders: orders.slice(0, 6).map(order => ({
      id: order.id,
      number: `PED-${String(order.folio).padStart(6, '0')}`,
      customerName: order.customerNameSnapshot,
      orderDate: dateOnly(order.orderDate),
      total: numeric(order.total),
      paymentStatus: order.paymentStatus,
      status: {
        key: order.status.key,
        label: order.status.label,
        color: order.status.color
      }
    }))
  }

  return result
})
