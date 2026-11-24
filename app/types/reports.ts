import type { ReportBreakdownItem, ReportDailyMovement as SharedReportDailyMovement, ReportPeriod, ReportRankingItem } from '@rafamedtech/nuxt-shared/utils'

export type { ReportBreakdownItem, ReportPeriod, ReportRankingItem }

export interface ReportMetrics {
  salesBeforeTax: number
  salesBeforeTaxChangePercentage: number | null
  operatingExpenses: number
  previousOperatingExpenses: number
  operatingExpensesChangePercentage: number | null
  materialPurchases: number
  previousMaterialPurchases: number
  materialPurchasesChangePercentage: number | null
  grossProfit: number
  previousGrossProfit: number
  grossProfitChangePercentage: number | null
  grossMarginPercentage: number | null
  previousGrossMarginPercentage: number | null
  netProfit: number
  previousNetProfit: number
  netProfitChangePercentage: number | null
  netMarginPercentage: number | null
  previousNetMarginPercentage: number | null
  purchaseInvoiceTotals: {
    currencyCode: string
    amount: number
    previousAmount: number
    changePercentage: number | null
  }[]
  sales: number
  previousOrderCount: number
  previousCounterSales: number
  previousSellerSales: number
  previousInternalSales: number
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

export interface ReportDailyMovement extends SharedReportDailyMovement {
  counterSales: number
  sellerSales: number
  internalSales: number
}

export interface BusinessReportSummary {
  period: ReportPeriod
  metrics: ReportMetrics
  dailyMovements: ReportDailyMovement[]
  salesChannels: ReportBreakdownItem[]
  expenseDetails: ReportExpenseDetail[]
  paymentMethods: ReportBreakdownItem[]
  expenseCategories: ReportBreakdownItem[]
  operatingExpenseCategories: ReportBreakdownItem[]
  topMaterialProviders: ReportRankingItem[]
  topDebtors: ReportRankingItem[]
  topCustomers: ReportRankingItem[]
  topProducts: ReportRankingItem[]
  salesByLine: ReportBreakdownItem[]
  topSellers: ReportRankingItem[]
}

export interface ReportExpenseDetail {
  id: string
  date: string
  category: string
  kind: 'material' | 'operating'
  description: string
  provider: string
  paymentMethod: string
  currencyCode: string
  originalAmount: number
  exchangeRate: number
  amount: number
  notes: string | null
}
