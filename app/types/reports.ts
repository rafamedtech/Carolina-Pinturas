export interface ReportPeriod {
  label: string
  start: string
  end: string
  elapsedDays: number
  totalDays: number
}

export interface ReportMetrics {
  sales: number
  previousSales: number
  salesChangePercentage: number | null
  collections: number
  previousCollections: number
  collectionsChangePercentage: number | null
  expenses: number
  previousExpenses: number
  expensesChangePercentage: number | null
  netCashFlow: number
  previousNetCashFlow: number
  netCashFlowChangePercentage: number | null
  orderCount: number
  averageTicket: number
  discounts: number
  outstandingBalance: number
  collectionCoveragePercentage: number
}

export interface ReportDailyMovement {
  date: string
  label: string
  sales: number
  collections: number
  expenses: number
  netCashFlow: number
}

export interface ReportBreakdownItem {
  key: string
  label: string
  amount: number
  count: number
  percentage: number
}

export interface ReportRankingItem {
  id: string
  label: string
  detail: string
  amount: number
  count: number
  percentage: number
}

export interface BusinessReportSummary {
  period: ReportPeriod
  metrics: ReportMetrics
  dailyMovements: ReportDailyMovement[]
  paymentMethods: ReportBreakdownItem[]
  expenseCategories: ReportBreakdownItem[]
  topCustomers: ReportRankingItem[]
  topProducts: ReportRankingItem[]
  topSellers: ReportRankingItem[]
}
