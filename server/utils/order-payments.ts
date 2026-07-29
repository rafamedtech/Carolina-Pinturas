import * as z from 'zod'
import type { SalesOrderPayment } from '../../generated/prisma/client'
import type { OrderPayment } from '~/types/siigo-payments'
import { PAYMENT_METHOD_KEYS } from '~/utils/orderPayment'
import { createOrderSiigoPaymentSchema as siigoPaymentSchema } from './siigo-vouchers'

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
