import type { Prisma } from '../../../generated/prisma/client'
import type {
  BusinessReportSummary,
  ReportBreakdownItem,
  ReportRankingItem
} from '~/types/reports'
import { PAYMENT_METHODS, paymentMethodLabel } from '~/utils/orderPayment'
import { requireRole } from '../../utils/auth'
import { usePrisma } from '../../utils/prisma'
import {
  reportDateOnly,
  reportMonthBounds,
  reportNumeric,
  reportPercentage,
  reportPercentageChange
} from '../../utils/reports'

const EXCLUDED_SALES_STATUSES = ['borrador', 'cancelado']

export default eventHandler(async (event) => {
  await requireRole(event, ['admin'])

  const prisma = usePrisma()
  const query = getQuery(event)
  const selectedMonth = typeof query.month === 'string' ? query.month : undefined
  const { start, end, previousStart, totalDays, elapsedDays, dayInMs } = reportMonthBounds(selectedMonth)
  const salesWhere = {
    statusKey: { notIn: EXCLUDED_SALES_STATUSES },
    orderDate: { gte: start, lt: end }
  } satisfies Prisma.SalesOrderWhereInput

  const [orders, previousSalesResult, collections, previousCollectionsResult, expenses, previousExpenses] = await Promise.all([
    prisma.salesOrder.findMany({
      where: salesWhere,
      select: {
        id: true,
        orderDate: true,
        total: true,
        discountTotal: true,
        customerId: true,
        customerNameSnapshot: true,
        vendedorEmail: true,
        vendedorNombre: true,
        payments: { select: { amount: true } },
        items: {
          select: {
            productId: true,
            productCodeSnapshot: true,
            productNameSnapshot: true,
            quantity: true,
            total: true
          }
        }
      }
    }),
    prisma.salesOrder.aggregate({
      where: {
        statusKey: { notIn: EXCLUDED_SALES_STATUSES },
        orderDate: { gte: previousStart, lt: start }
      },
      _sum: { total: true }
    }),
    prisma.salesOrderPayment.findMany({
      where: { paymentDate: { gte: start, lt: end } },
      select: { paymentDate: true, paymentMethod: true, amount: true }
    }),
    prisma.salesOrderPayment.aggregate({
      where: { paymentDate: { gte: previousStart, lt: start } },
      _sum: { amount: true }
    }),
    prisma.expense.findMany({
      where: { expenseDate: { gte: start, lt: end } },
      select: { expenseDate: true, category: true, amount: true, exchangeRate: true }
    }),
    prisma.expense.findMany({
      where: { expenseDate: { gte: previousStart, lt: start } },
      select: { amount: true, exchangeRate: true }
    })
  ] as const)

  const sales = orders.reduce((sum, order) => sum + reportNumeric(order.total), 0)
  const previousSales = reportNumeric(previousSalesResult._sum.total)
  const collectionsAmount = collections.reduce((sum, payment) => sum + reportNumeric(payment.amount), 0)
  const previousCollections = reportNumeric(previousCollectionsResult._sum.amount)
  const expensesAmount = expenses.reduce(
    (sum, expense) => sum + reportNumeric(expense.amount) * reportNumeric(expense.exchangeRate),
    0
  )
  const previousExpensesAmount = previousExpenses.reduce(
    (sum, expense) => sum + reportNumeric(expense.amount) * reportNumeric(expense.exchangeRate),
    0
  )
  const netCashFlow = collectionsAmount - expensesAmount
  const previousNetCashFlow = previousCollections - previousExpensesAmount
  const discounts = orders.reduce((sum, order) => sum + reportNumeric(order.discountTotal), 0)
  const outstandingBalance = orders.reduce((sum, order) => {
    const paid = order.payments.reduce((paymentSum, payment) => paymentSum + reportNumeric(payment.amount), 0)
    return sum + Math.max(reportNumeric(order.total) - paid, 0)
  }, 0)

  const dailySales = new Map<string, number>()
  const dailyCollections = new Map<string, number>()
  const dailyExpenses = new Map<string, number>()

  for (const order of orders) {
    const key = reportDateOnly(order.orderDate)
    dailySales.set(key, (dailySales.get(key) ?? 0) + reportNumeric(order.total))
  }

  for (const payment of collections) {
    const key = reportDateOnly(payment.paymentDate)
    dailyCollections.set(key, (dailyCollections.get(key) ?? 0) + reportNumeric(payment.amount))
  }

  for (const expense of expenses) {
    const key = reportDateOnly(expense.expenseDate)
    const amount = reportNumeric(expense.amount) * reportNumeric(expense.exchangeRate)
    dailyExpenses.set(key, (dailyExpenses.get(key) ?? 0) + amount)
  }

  const dailyMovements = Array.from({ length: elapsedDays }, (_, index) => {
    const date = new Date(start.getTime() + index * dayInMs)
    const key = reportDateOnly(date)
    const dayCollections = dailyCollections.get(key) ?? 0
    const dayExpenses = dailyExpenses.get(key) ?? 0

    return {
      date: key,
      label: new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date),
      sales: dailySales.get(key) ?? 0,
      collections: dayCollections,
      expenses: dayExpenses,
      netCashFlow: dayCollections - dayExpenses
    }
  })

  function breakdown<T>(
    entries: readonly T[],
    keyOf: (entry: T) => string,
    amountOf: (entry: T) => number,
    total: number,
    labelOf: (key: string) => string = key => key
  ): ReportBreakdownItem[] {
    const grouped = new Map<string, { amount: number, count: number }>()

    for (const entry of entries) {
      const key = keyOf(entry)
      const current = grouped.get(key) ?? { amount: 0, count: 0 }
      current.amount += amountOf(entry)
      current.count += 1
      grouped.set(key, current)
    }

    return [...grouped.entries()]
      .map(([key, value]) => ({
        key,
        label: labelOf(key),
        ...value,
        percentage: reportPercentage(value.amount, total)
      }))
      .sort((a, b) => b.amount - a.amount)
  }

  function ranking(
    grouped: Map<string, Omit<ReportRankingItem, 'id' | 'percentage'>>,
    total: number
  ): ReportRankingItem[] {
    return [...grouped.entries()]
      .map(([id, value]) => ({ ...value, id, percentage: reportPercentage(value.amount, total) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
  }

  const customers = new Map<string, Omit<ReportRankingItem, 'id' | 'percentage'>>()
  const sellers = new Map<string, Omit<ReportRankingItem, 'id' | 'percentage'>>()
  const products = new Map<string, Omit<ReportRankingItem, 'id' | 'percentage'>>()

  for (const order of orders) {
    const orderTotal = reportNumeric(order.total)
    const customer = customers.get(order.customerId) ?? {
      label: order.customerNameSnapshot,
      detail: 'Cliente',
      amount: 0,
      count: 0
    }
    customer.amount += orderTotal
    customer.count += 1
    customers.set(order.customerId, customer)

    const seller = sellers.get(order.vendedorEmail) ?? {
      label: order.vendedorNombre,
      detail: order.vendedorEmail,
      amount: 0,
      count: 0
    }
    seller.amount += orderTotal
    seller.count += 1
    sellers.set(order.vendedorEmail, seller)

    for (const item of order.items) {
      const product = products.get(item.productId) ?? {
        label: item.productNameSnapshot,
        detail: item.productCodeSnapshot,
        amount: 0,
        count: 0
      }
      product.amount += reportNumeric(item.total)
      product.count += reportNumeric(item.quantity)
      products.set(item.productId, product)
    }
  }

  const paymentMethodOrder = new Map(PAYMENT_METHODS.map((method, index) => [method.key, index]))
  const paymentMethods = breakdown(
    collections,
    payment => payment.paymentMethod,
    payment => reportNumeric(payment.amount),
    collectionsAmount,
    paymentMethodLabel
  ).sort((a, b) => (paymentMethodOrder.get(a.key as typeof PAYMENT_METHODS[number]['key']) ?? 99)
    - (paymentMethodOrder.get(b.key as typeof PAYMENT_METHODS[number]['key']) ?? 99))

  const result: BusinessReportSummary = {
    period: {
      label: new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(start),
      start: reportDateOnly(start),
      end: reportDateOnly(new Date(end.getTime() - dayInMs)),
      elapsedDays,
      totalDays
    },
    metrics: {
      sales,
      previousSales,
      salesChangePercentage: reportPercentageChange(sales, previousSales),
      collections: collectionsAmount,
      previousCollections,
      collectionsChangePercentage: reportPercentageChange(collectionsAmount, previousCollections),
      expenses: expensesAmount,
      previousExpenses: previousExpensesAmount,
      expensesChangePercentage: reportPercentageChange(expensesAmount, previousExpensesAmount),
      netCashFlow,
      previousNetCashFlow,
      netCashFlowChangePercentage: reportPercentageChange(netCashFlow, previousNetCashFlow),
      orderCount: orders.length,
      averageTicket: orders.length > 0 ? sales / orders.length : 0,
      discounts,
      outstandingBalance,
      collectionCoveragePercentage: reportPercentage(sales - outstandingBalance, sales)
    },
    dailyMovements,
    paymentMethods,
    expenseCategories: breakdown(
      expenses,
      expense => expense.category,
      expense => reportNumeric(expense.amount) * reportNumeric(expense.exchangeRate),
      expensesAmount
    ),
    topCustomers: ranking(customers, sales),
    topProducts: ranking(products, sales),
    topSellers: ranking(sellers, sales)
  }

  return result
})
