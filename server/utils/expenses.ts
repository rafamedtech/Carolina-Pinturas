import { hasDecimalScale, isIsoCalendarDate, isPositiveAmount } from '@rafamedtech/nuxt-shared/utils'
import * as z from 'zod'
import type { Expense } from '../../generated/prisma/client'
import type { ExpenseRecord } from '~/types/expenses'
import type { ExpenseCategory, ExpenseCurrencyCode } from '~/utils/expense'
import { EXPENSE_CATEGORIES, EXPENSE_CURRENCIES } from '~/utils/expense'
import { PAYMENT_METHOD_KEYS } from '~/utils/orderPayment'

const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa una fecha con formato AAAA-MM-DD.')
  .refine(isIsoCalendarDate, 'Selecciona una fecha válida.')
const amountSchema = z.number()
  .refine(isPositiveAmount, 'El importe debe ser mayor a cero.')
  .max(9_999_999_999_999.99)
  .refine(value => hasDecimalScale(value, 2), 'El importe admite máximo dos decimales.')
const exchangeRateSchema = z.number()
  .refine(isPositiveAmount, 'El tipo de cambio debe ser mayor a cero.')
  .max(1_000_000)
  .refine(value => hasDecimalScale(value, 6), 'El tipo de cambio admite máximo seis decimales.')

export const createExpenseSchema = z.object({
  productId: z.uuid().nullish(),
  date: dateSchema,
  category: z.enum(EXPENSE_CATEGORIES as unknown as [ExpenseCategory, ...ExpenseCategory[]]),
  description: z.string().trim().min(3, 'Describe el gasto.').max(250),
  providerId: z.string().uuid('Selecciona un proveedor válido.'),
  currencyCode: z.enum(
    EXPENSE_CURRENCIES.map(currency => currency.value) as [ExpenseCurrencyCode, ...ExpenseCurrencyCode[]]
  ),
  exchangeRate: exchangeRateSchema,
  amount: amountSchema,
  paymentMethod: z.enum(PAYMENT_METHOD_KEYS as [string, ...string[]]),
  notes: z.string().trim().max(1000).default('')
}).superRefine((data, context) => {
  if (data.currencyCode === 'MXN' && data.exchangeRate !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['exchangeRate'],
      message: 'El tipo de cambio para MXN debe ser 1.'
    })
  }
})

export type CreateExpenseData = z.output<typeof createExpenseSchema>

function decimal(value: { toString(): string }) {
  return Number(value.toString())
}

export function expenseView(expense: Expense): ExpenseRecord {
  return {
    id: expense.id,
    productId: expense.productId,
    purchasePaymentId: expense.purchasePaymentId,
    date: expense.expenseDate.toISOString().slice(0, 10),
    category: expense.category as ExpenseCategory,
    description: expense.description,
    providerId: expense.providerId,
    provider: expense.providerNameSnapshot,
    providerRfc: expense.providerRfcSnapshot,
    currencyCode: expense.currencyCode as ExpenseCurrencyCode,
    exchangeRate: decimal(expense.exchangeRate),
    amount: decimal(expense.amount),
    paymentMethod: expense.paymentMethod as ExpenseRecord['paymentMethod'],
    notes: expense.notes,
    createdBy: {
      name: expense.createdByName,
      email: expense.createdByEmail
    },
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString()
  }
}

export async function validateExpenseProduct(productId?: string | null, previousProductId?: string | null) {
  if (!productId || productId === previousProductId) return
  const { usePrisma } = await import('./prisma')
  const { createError } = await import('h3')
  const { assertNoPendingProductWrites } = await import('./product-compositions')
  const db = usePrisma()
  const product = await db.siigoProduct.findUnique({ where: { id: productId } })
  if (!product || product.active === false || !product.availableForExpense || (product.type && product.type !== 'Product')) {
    throw createError({ statusCode: 422, statusMessage: 'El producto no está disponible para gasto.' })
  }
  await assertNoPendingProductWrites(db, [product])
}
