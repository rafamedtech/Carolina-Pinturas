import type { OrderStatus } from '~/types/orders'
import type { BadgeColor } from '~/utils/orderStatus'

export interface DashboardPeriod {
  label: string
  start: string
  end: string
  elapsedDays: number
  totalDays: number
}

export interface DashboardMetrics {
  sales: number
  previousSales: number
  salesChangePercentage: number | null
  projectedSales: number
  orderCount: number
  averageTicket: number
  pendingAmount: number
  collectedAmount: number
}

export interface DashboardDailySale {
  date: string
  label: string
  total: number
  orders: number
}

export interface DashboardBreakdownItem {
  key: string
  label: string
  color: BadgeColor
  count: number
  amount: number
  percentage: number
}

export interface DashboardTopProduct {
  productId: string
  code: string
  name: string
  quantity: number
  amount: number
  percentage: number
}

export interface DashboardRecentOrder {
  id: string
  number: string
  customerName: string
  orderDate: string
  total: number
  paymentStatus: string
  paymentMethod: string | null
  status: Pick<OrderStatus, 'key' | 'label' | 'color'>
}

export interface SalesDashboardSummary {
  period: DashboardPeriod
  metrics: DashboardMetrics
  dailySales: DashboardDailySale[]
  paymentBreakdown: DashboardBreakdownItem[]
  statusBreakdown: DashboardBreakdownItem[]
  topProducts: DashboardTopProduct[]
  recentOrders: DashboardRecentOrder[]
}
