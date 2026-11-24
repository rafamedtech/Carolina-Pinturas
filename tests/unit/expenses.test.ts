import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import type { Expense } from '../../generated/prisma/client'
import { createExpenseSchema, expenseView } from '../../server/utils/expenses'

const validExpense = {
  date: '2026-08-31',
  category: 'Compra de materiales',
  description: 'Compra de pintura vinílica',
  providerId: '6b6ceb28-b2eb-4b98-b3dd-26648a933c81',
  currencyCode: 'MXN',
  exchangeRate: 1,
  amount: 1250.50,
  paymentMethod: 'transferencia',
  notes: 'Factura pendiente de recibir'
}

describe('persistencia de gastos', () => {
  it('acepta un gasto completo y normaliza textos', () => {
    const result = createExpenseSchema.safeParse({
      ...validExpense,
      description: '  Compra de pintura vinílica  ',
      notes: '  Factura pendiente de recibir  '
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBe('Compra de pintura vinílica')
      expect(result.data.notes).toBe('Factura pendiente de recibir')
    }
  })

  it('rechaza fechas inexistentes, importes inválidos y valores fuera del catálogo', () => {
    expect(createExpenseSchema.safeParse({ ...validExpense, date: '2026-02-31' }).success).toBe(false)
    expect(createExpenseSchema.safeParse({ ...validExpense, amount: 10.001 }).success).toBe(false)
    expect(createExpenseSchema.safeParse({ ...validExpense, category: 'Categoría inventada' }).success).toBe(false)
    expect(createExpenseSchema.safeParse({ ...validExpense, paymentMethod: 'criptomoneda' }).success).toBe(false)
  })

  it('fija el tipo de cambio de MXN en uno y admite USD con seis decimales', () => {
    expect(createExpenseSchema.safeParse({ ...validExpense, exchangeRate: 17.5 }).success).toBe(false)
    expect(createExpenseSchema.safeParse({
      ...validExpense,
      currencyCode: 'USD',
      exchangeRate: 17.123456
    }).success).toBe(true)
    expect(createExpenseSchema.safeParse({
      ...validExpense,
      currencyCode: 'USD',
      exchangeRate: 17.1234567
    }).success).toBe(false)
  })

  it('conserva los límites, las escalas y los mensajes de gastos', () => {
    const input = { ...validExpense, currencyCode: 'USD' }
    expect(createExpenseSchema.safeParse({ ...input, date: '2024-02-29', amount: 0.01, exchangeRate: 0.000001 }).success).toBe(true)
    expect(createExpenseSchema.safeParse({ ...input, amount: 9_999_999_999_999.99, exchangeRate: 1_000_000 }).success).toBe(true)

    const cases = [
      [{ amount: 0 }, 'El importe debe ser mayor a cero.'],
      [{ amount: 0.001 }, 'El importe admite máximo dos decimales.'],
      [{ amount: 10_000_000_000_000 }, 'Too big: expected number to be <=9999999999999.99'],
      [{ exchangeRate: -1 }, 'El tipo de cambio debe ser mayor a cero.'],
      [{ exchangeRate: 0.0000001 }, 'El tipo de cambio admite máximo seis decimales.'],
      [{ exchangeRate: 1_000_000.01 }, 'Too big: expected number to be <=1000000'],
      [{ date: '2026-02-29' }, 'Selecciona una fecha válida.'],
      [{ date: '31/08/2026' }, 'Usa una fecha con formato AAAA-MM-DD.']
    ] as const
    for (const [fields, message] of cases) {
      expect(createExpenseSchema.safeParse({ ...input, ...fields }).error?.issues[0]?.message).toBe(message)
    }

    for (const amount of ['12.50', Number.NaN, Infinity]) {
      expect(createExpenseSchema.safeParse({ ...input, amount }).success).toBe(false)
    }
  })

  it('convierte decimales y fechas de Prisma a la vista pública', () => {
    const expense = {
      id: '299fb710-70ba-4847-a8eb-5fc9ef050fb4',
      expenseDate: new Date('2026-08-31T00:00:00.000Z'),
      category: 'Compra de materiales',
      description: validExpense.description,
      providerId: validExpense.providerId,
      providerNameSnapshot: 'PROVEEDOR UNO',
      providerRfcSnapshot: 'ABC010101ABC',
      providerPayload: {},
      currencyCode: 'USD',
      exchangeRate: new Decimal('17.123456'),
      amount: new Decimal('1250.50'),
      paymentMethod: 'transferencia',
      notes: null,
      createdByUserId: null,
      createdByName: 'Administrador',
      createdByEmail: 'admin@example.com',
      createdByRole: 'admin',
      createdAt: new Date('2026-08-31T18:00:00.000Z'),
      updatedAt: new Date('2026-08-31T18:00:00.000Z')
    } as Expense

    expect(expenseView(expense)).toEqual(expect.objectContaining({
      date: '2026-08-31',
      provider: 'PROVEEDOR UNO',
      amount: 1250.5,
      exchangeRate: 17.123456,
      notes: null
    }))
  })
})
