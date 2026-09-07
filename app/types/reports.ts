export interface ReportPeriod {
  label: string
  start: string
  end: string
  elapsedDays: number
  totalDays: number
}

export interface ReportMetrics {
  sales: number
  previousOrderCount: number
  previousCounterSales: number
  previousSellerSales: number
  previousDays: number
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
  orderCount: number
  counterSales: number
  sellerSales: number
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
  salesChannels: ReportBreakdownItem[]
  expenseDetails: ReportExpenseDetail[]
  paymentMethods: ReportBreakdownItem[]
  expenseCategories: ReportBreakdownItem[]
  topDebtors: ReportRankingItem[]
  topCustomers: ReportRankingItem[]
  topProducts: ReportRankingItem[]
  topSellers: ReportRankingItem[]
}

export interface ReportExpenseDetail {
  id: string
  date: string
  category: string
  description: string
  provider: string
  paymentMethod: string
  currencyCode: string
  originalAmount: number
  exchangeRate: number
  amount: number
  notes: string | null
}
