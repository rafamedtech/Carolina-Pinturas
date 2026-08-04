import * as z from 'zod'
import type { Prisma, SalesOrderPayment } from '../../generated/prisma/client'
import type { AppUser, UserRole } from '~/types/siigo'
import type { OrderPayment } from '~/types/siigo-payments'
import { canDeletePaymentRecord, PAYMENT_METHOD_KEYS } from '~/utils/orderPayment'
import { createOrderSiigoPaymentSchema as siigoPaymentSchema } from './siigo-vouchers'

const PAYMENT_DELETE_TRANSACTION_OPTIONS = {
  isolationLevel: 'Serializable' as const,
  maxWait: 5_000,
  timeout: 15_000
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa una fecha con formato AAAA-MM-DD.')
const amountSchema = z.number().positive('El importe debe ser mayor a cero.')
  .max(9_999_999_999_999.99)
  .refine(value => Number(value.toFixed(2)) === value, 'El importe admite máximo dos decimales.')

export const createLocalOrderPaymentSchema = z.object({
  destination: z.literal('local'),
  requestId: z.string().uuid(),
  paymentMethod: z.enum(PAYMENT_METHOD_KEYS as [string, ...string[]]),
  amount: amountSchema,
  date: dateSchema,
  reference: z.string().trim().max(250).nullable().optional(),
  observations: z.string().trim().max(2500).nullable().optional()
})

export const createOrderPaymentSchema = z.discriminatedUnion('destination', [
  createLocalOrderPaymentSchema,
  siigoPaymentSchema
])

export function paymentDestinationForOrder(requiresInvoice: boolean) {
  return requiresInvoice ? 'siigo' : 'local'
}

export function assertInitialLocalPaymentAllowed(requiresInvoice: boolean) {
  if (requiresInvoice) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Un pedido con factura no puede registrar un pago inicial local.'
    })
  }
}

export function paymentMethodFromCfdi(cfdiCode: string) {
  if (cfdiCode === '01') return 'efectivo'
  if (cfdiCode === '02') return 'cheque'
  if (cfdiCode === '03') return 'transferencia'
  if (cfdiCode === '04' || cfdiCode === '28') return 'tarjeta'
  return 'otro'
}

export function paymentStatus(totalPaid: number, orderTotal: number) {
  if (totalPaid <= 0) return 'pendiente_pago'
  return totalPaid + 0.005 >= orderTotal ? 'pago_recibido' : 'abonado'
}

export function assertPaymentFitsBalance(amount: number, paidTotal: number, orderTotal: number) {
  const balance = Math.max(0, orderTotal - paidTotal)
  if (amount > balance + 0.005) {
    throw createError({
      statusCode: 422,
      statusMessage: `El importe supera el saldo pendiente de ${balance.toFixed(2)}.`
    })
  }
}

export function assertOrderPaymentDeletionRole(role: UserRole) {
  if (role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Solo un administrador puede eliminar pagos.'
    })
  }
}

export function canDeleteOrderPayment(payment: Pick<SalesOrderPayment, 'provider' | 'externalStatus' | 'siigoVoucherId'>) {
  return canDeletePaymentRecord(payment.provider, payment.externalStatus, payment.siigoVoucherId)
}

export async function deleteOrderPayment(orderId: string, paymentId: string, user: AppUser) {
  assertOrderPaymentDeletionRole(user.role)
  const { usePrisma } = await import('./prisma')

  return usePrisma().$transaction(async (tx: Prisma.TransactionClient) => {
    const order = await tx.salesOrder.findUnique({
      where: { id: orderId },
      select: { total: true }
    })
    const payment = await tx.salesOrderPayment.findFirst({
      where: { id: paymentId, orderId }
    })

    if (!order) {
      throw createError({ statusCode: 404, statusMessage: 'No se encontró el pedido.' })
    }
    if (!payment) {
      throw createError({ statusCode: 404, statusMessage: 'No se encontró el pago.' })
    }
    if (!canDeleteOrderPayment(payment)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Este pago puede estar vinculado con una recepción en Siigo y no se puede eliminar únicamente en la aplicación.'
      })
    }

    await tx.salesOrderPayment.delete({ where: { id: payment.id } })

    const totals = await tx.salesOrderPayment.aggregate({
      where: { orderId },
      _sum: { amount: true }
    })
    const latestPayment = await tx.salesOrderPayment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      select: { paymentMethod: true, paymentDate: true }
    })
    const totalPaid = Number(totals._sum.amount?.toString() || 0)

    await tx.salesOrder.update({
      where: { id: orderId },
      data: {
        paymentStatus: paymentStatus(totalPaid, Number(order.total.toString())),
        paymentMethod: latestPayment?.paymentMethod ?? null,
        paymentDate: latestPayment?.paymentDate ?? null,
        updatedByEmail: user.email,
        version: { increment: 1 }
      }
    })

    return { id: payment.id }
  }, PAYMENT_DELETE_TRANSACTION_OPTIONS)
}

function decimal(value: { toString(): string }) {
  return Number(value.toString())
}

export function orderPaymentView(payment: SalesOrderPayment): OrderPayment {
  const hasSiigoData = payment.provider === 'siigo'
    && payment.siigoInvoiceId
    && payment.siigoInvoiceName
    && payment.siigoDocumentTypeId
    && payment.siigoPaymentTypeId
    && payment.siigoCfdiCode
    && payment.siigoPaymentMethod
    && payment.siigoQuote

  return {
    id: payment.id,
    requestId: payment.requestId,
    provider: payment.provider,
    externalStatus: payment.externalStatus as OrderPayment['externalStatus'],
    externalError: payment.externalError,
    paymentMethod: payment.paymentMethod,
    amount: decimal(payment.amount),
    currencyCode: payment.currencyCode,
    paymentDate: payment.paymentDate.toISOString().slice(0, 10),
    reference: payment.reference,
    observations: payment.observations,
    siigo: hasSiigoData
      ? {
          voucherId: payment.siigoVoucherId,
          voucherName: payment.siigoVoucherName,
          invoiceId: payment.siigoInvoiceId!,
          invoiceName: payment.siigoInvoiceName!,
          documentTypeId: payment.siigoDocumentTypeId!,
          paymentTypeId: payment.siigoPaymentTypeId!,
          costCenterId: payment.siigoCostCenterId,
          cfdiCode: payment.siigoCfdiCode!,
          paymentMethod: payment.siigoPaymentMethod === 'PPD' ? 'PPD' : 'PUE',
          quote: payment.siigoQuote!
        }
      : null,
    createdBy: {
      name: payment.createdByName,
      email: payment.createdByEmail
    },
    createdAt: payment.createdAt.toISOString()
  }
}
