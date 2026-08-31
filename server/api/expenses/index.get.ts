import { Prisma } from '../../../generated/prisma/client'
import type { ExpenseListResponse } from '~/types/expenses'
import { ADMIN_ONLY_EXPENSE_CATEGORIES } from '~/utils/expense'
import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import { expenseView } from '../../utils/expenses'
import { usePrisma } from '../../utils/prisma'

function positiveInteger(value: unknown, fallback: number, maximum: number) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return fallback
  return Math.min(parsed, maximum)
}

function dateOnly(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined

  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? undefined
    : value
}

export default eventHandler(async (event): Promise<ExpenseListResponse> => {
  const user = await requireRole(event, ORDER_LOGISTICS_ROLES)
  const hiddenCategories = user.role === 'admin' ? [] : [...ADMIN_ONLY_EXPENSE_CATEGORIES]
  const query = getQuery(event)
  const page = positiveInteger(query.page, 1, 100_000)
  const pageSize = positiveInteger(query.page_size, 25, 100)
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 200) : ''
  const paymentMethod = typeof query.payment_method === 'string'
    ? query.payment_method.trim().slice(0, 32)
    : ''
  const category = typeof query.category === 'string' ? query.category.trim().slice(0, 64) : ''
  const dateFrom = dateOnly(query.date_from)
  const dateTo = dateOnly(query.date_to)
  const searchFilter: Prisma.ExpenseWhereInput = search
    ? {
        OR: [{
          description: { contains: search, mode: 'insensitive' }
        }, {
          notes: { contains: search, mode: 'insensitive' }
        }, {
          category: { contains: search, mode: 'insensitive' }
        }, {
          providerNameSnapshot: { contains: search, mode: 'insensitive' }
        }, {
          providerRfcSnapshot: { contains: search, mode: 'insensitive' }
        }, {
          createdByName: { contains: search, mode: 'insensitive' }
        }, {
          createdByEmail: { contains: search, mode: 'insensitive' }
        }]
      }
    : {}
  const dateFilter: Prisma.ExpenseWhereInput = dateFrom || dateTo
    ? {
        expenseDate: {
          ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
          ...(dateTo ? { lte: new Date(`${dateTo}T00:00:00.000Z`) } : {})
        }
      }
    : {}
  const where: Prisma.ExpenseWhereInput = {
    AND: [
      searchFilter,
      dateFilter,
      ...(paymentMethod ? [{ paymentMethod }] : []),
      ...(category ? [{ category }] : []),
      ...(hiddenCategories.length ? [{ category: { notIn: hiddenCategories } }] : [])
    ]
  }
  const searchPattern = `%${search.replace(/[\\%_]/g, character => `\\${character}`)}%`
  const totalConditions = [
    Prisma.sql`TRUE`,
    ...(search
      ? [Prisma.sql`(
        description ILIKE ${searchPattern}
        OR notes ILIKE ${searchPattern}
        OR category ILIKE ${searchPattern}
        OR provider_name_snapshot ILIKE ${searchPattern}
        OR provider_rfc_snapshot ILIKE ${searchPattern}
        OR created_by_name ILIKE ${searchPattern}
        OR created_by_email ILIKE ${searchPattern}
      )`]
      : []),
    ...(dateFrom ? [Prisma.sql`expense_date >= ${dateFrom}::date`] : []),
    ...(dateTo ? [Prisma.sql`expense_date <= ${dateTo}::date`] : []),
    ...(paymentMethod ? [Prisma.sql`payment_method = ${paymentMethod}`] : []),
    ...(category ? [Prisma.sql`category = ${category}`] : []),
    ...(hiddenCategories.length
      ? [Prisma.sql`category NOT IN (${Prisma.join(hiddenCategories)})`]
      : [])
  ]
  const prisma = usePrisma()
  const [expenses, totalResults, totalRows] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.expense.count({ where }),
    prisma.$queryRaw<{ total: Prisma.Decimal | null }[]>`
      SELECT SUM(amount * exchange_rate) AS total
      FROM expenses
      WHERE ${Prisma.join(totalConditions, ' AND ')}
    `
  ] as const)

  return {
    results: expenses.map(expenseView),
    filteredTotal: Number(totalRows[0]?.total?.toString() || 0),
    pagination: {
      page,
      pageSize,
      totalResults,
      totalPages: Math.ceil(totalResults / pageSize)
    }
  }
})
