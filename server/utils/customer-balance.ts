import { orderMoney } from '#shared/utils/orderAmounts'
import { mexicoToday } from '#shared/utils/datetime'
import type { CustomerBalanceSummary } from '#shared/types/customerBalance'
import { orderPaymentTotals } from './order-payments'

interface BalanceOrder {
  statusKey: string
  orderDate: Date
  total: number
  payments: { amount: number }[]
}

export function customerBalanceSummary(customerId: string, orders: readonly BalanceOrder[], today = mexicoToday()): CustomerBalanceSummary {
  const cutoff = new Date(`${today}T00:00:00.000Z`).getTime() - 7 * 86_400_000
  let balance = orderMoney(0)
  let pendingOrders = 0
  let recentUnpaidOrders = 0
  let overdueOrders = 0

  for (const order of orders) {
    if (['borrador', 'cancelado'].includes(order.statusKey)) continue
    const totals = orderPaymentTotals(order.total, order.payments)
    if (totals.balance <= 0) continue
    balance = balance.plus(totals.balance)
    pendingOrders++
    if (order.orderDate.getTime() < cutoff) overdueOrders++
    else if (totals.paidTotal === 0) recentUnpaidOrders++
  }

  return {
    customerId,
    balance: balance.toNumber(),
    pendingOrders,
    recentUnpaidOrders,
    overdueOrders,
    status: pendingOrders === 0 ? 'current' : overdueOrders > 0 ? 'overdue' : 'recent'
  }
}
