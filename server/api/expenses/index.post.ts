import type { Prisma } from '../../../generated/prisma/client'
import type { ExpenseRecord } from '~/types/expenses'
import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { siigoCustomerName } from '~/utils/siigoCustomer'
import { requireRole } from '../../utils/auth'
import { createExpenseSchema, expenseView } from '../../utils/expenses'
import { usePrisma } from '../../utils/prisma'
import { getSiigoCustomerDetail } from '../../utils/siigo-customer-detail'
import { siigoCustomerPersistenceState } from '../../utils/siigo-customers'

export default eventHandler(async (event): Promise<ExpenseRecord> => {
  const user = await requireRole(event, ORDER_LOGISTICS_ROLES)
  const parsed = createExpenseSchema.safeParse(await readBody(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Revisa los datos del gasto.',
      data: parsed.error.flatten()
    })
  }

  const prisma = usePrisma()
  const [provider, siigoProvider] = await Promise.all([
    prisma.siigoCustomer.findFirst({
      where: {
        id: parsed.data.providerId,
        type: { equals: 'Supplier', mode: 'insensitive' }
      },
      select: { id: true, type: true, active: true }
    }),
    getSiigoCustomerDetail(parsed.data.providerId)
  ] as const)

  if (!provider) {
    throw createError({
      statusCode: 422,
      statusMessage: 'El proveedor seleccionado no está marcado como Supplier en PostgreSQL.'
    })
  }
  if (provider.active === false) {
    throw createError({ statusCode: 422, statusMessage: 'El proveedor seleccionado está inactivo.' })
  }
  if (siigoProvider.type?.trim().toLowerCase() !== 'supplier') {
    throw createError({
      statusCode: 422,
      statusMessage: 'El proveedor seleccionado ya no está marcado como Supplier en Siigo.'
    })
  }
  if (siigoProvider.active === false) {
    throw createError({ statusCode: 422, statusMessage: 'El proveedor seleccionado está inactivo en Siigo.' })
  }

  const providerName = siigoCustomerName(siigoProvider) || siigoProvider.rfc_id || siigoProvider.id
  const providerPayload = JSON.parse(
    JSON.stringify(siigoCustomerPersistenceState(siigoProvider))
  ) as Prisma.InputJsonValue
  const expense = await prisma.expense.create({
    data: {
      expenseDate: new Date(`${parsed.data.date}T00:00:00.000Z`),
      category: parsed.data.category,
      description: parsed.data.description,
      providerId: provider.id,
      providerNameSnapshot: providerName,
      providerRfcSnapshot: siigoProvider.rfc_id || null,
      providerPayload,
      currencyCode: parsed.data.currencyCode,
      exchangeRate: parsed.data.exchangeRate,
      amount: parsed.data.amount,
      paymentMethod: parsed.data.paymentMethod,
      notes: parsed.data.notes || null,
      createdByUserId: user.id,
      createdByName: user.name,
      createdByEmail: user.email,
      createdByRole: user.role
    }
  })

  setResponseStatus(event, 201)
  return expenseView(expense)
})
