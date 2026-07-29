import type { Prisma } from '../../../generated/prisma/client'
import type { PaymentListResponse } from '~/types/payments'
import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
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

function orderNumber(folio: number) {
  return `PED-${String(folio).padStart(6, '0')}`
}

export default eventHandler(async (event): Promise<PaymentListResponse> => {
  await requireRole(event, ORDER_LOGISTICS_ROLES)
  const query = getQuery(event)
  const page = positiveInteger(query.page, 1, 100_000)
  const pageSize = positiveInteger(query.page_size, 25, 100)
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 200) : ''
  const paymentMethod = typeof query.payment_method === 'string'
    ? query.payment_method.trim().slice(0, 32)
    : ''
  const dateFrom = dateOnly(query.date_from)
  const dateTo = dateOnly(query.date_to)
  const folioMatch = search.toUpperCase().match(/^(?:PED-?)?0*(\d+)$/)
  const folio = folioMatch?.[1] ? Number(folioMatch[1]) : null
  const searchFilter: Prisma.SalesOrderPaymentWhereInput = search
    ? {
        OR: [{
          reference: { contains: search, mode: 'insensitive' }
        }, {
          observations: { contains: search, mode: 'insensitive' }
        }, {
          createdByName: { contains: search, mode: 'insensitive' }
        }, {
          createdByEmail: { contains: search, mode: 'insensitive' }
        }, {
          siigoVoucherName: { contains: search, mode: 'insensitive' }
        }, {
          order: { customerNameSnapshot: { contains: search, mode: 'insensitive' } }
        }, ...(folio && Number.isSafeInteger(folio) ? [{ order: { folio } }] : [])]
      }
    : {}
  const dateFilter: Prisma.SalesOrderPaymentWhereInput = dateFrom || dateTo
    ? {
        paymentDate: {
          ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
          ...(dateTo
            ? { lt: new Date(new Date(`${dateTo}T00:00:00.000Z`).getTime() + 86_400_000) }
            : {})
        }
      }
    : {}
  const where: Prisma.SalesOrderPaymentWhereInput = {
    AND: [
      searchFilter,
      dateFilter,
      ...(paymentMethod ? [{ paymentMethod }] : [])
    ]
  }
  const prisma = usePrisma()
  const [payments, totalResults, totalAmount] = await prisma.$transaction(async (tx) => {
    const payments = await tx.salesOrderPayment.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            folio: true,
            customerNameSnapshot: true
          }
        }
      },
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize
    })
    const totalResults = await tx.salesOrderPayment.count({ where })
    const totalAmount = await tx.salesOrderPayment.aggregate({
      where,
      _sum: { amount: true }
    })

    return [payments, totalResults, totalAmount] as const
  })

  return {
    results: payments.map(payment => ({
      id: payment.id,
      order: {
        id: payment.order.id,
        number: orderNumber(payment.order.folio),
        customerName: payment.order.customerNameSnapshot
      },
      provider: payment.provider,
      externalStatus: payment.externalStatus as PaymentListResponse['results'][number]['externalStatus'],
      paymentMethod: payment.paymentMethod,
      amount: Number(payment.amount.toString()),
      currencyCode: payment.currencyCode,
      paymentDate: payment.paymentDate.toISOString().slice(0, 10),
      reference: payment.reference,
      observations: payment.observations,
      siigoVoucherName: payment.siigoVoucherName,
      createdBy: {
        name: payment.createdByName,
        email: payment.createdByEmail
      },
      createdAt: payment.createdAt.toISOString()
    })),
    filteredTotal: Number(totalAmount._sum.amount?.toString() || 0),
    pagination: {
      page,
      pageSize,
      totalResults,
      totalPages: Math.ceil(totalResults / pageSize)
    }
  }
})
