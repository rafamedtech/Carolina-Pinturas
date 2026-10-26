export interface CustomerBalanceSummary {
  customerId: string
  balance: number
  pendingOrders: number
  recentUnpaidOrders: number
  overdueOrders: number
  status: 'current' | 'recent' | 'overdue'
}
