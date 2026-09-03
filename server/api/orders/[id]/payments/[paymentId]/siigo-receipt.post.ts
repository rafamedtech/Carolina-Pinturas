import type { CreateOrderSiigoPaymentInput, OrderPayment } from '~/types/siigo-payments'
import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../../../utils/auth'
import { getOrder } from '../../../../../utils/orders'
import { orderPaymentView } from '../../../../../utils/order-payments'
import { usePrisma } from '../../../../../utils/prisma'
import { siigoRequest } from '../../../../../utils/siigo'
import type { SiigoCustomerApiResponse } from '../../../../../utils/siigo-customers'
import { normalizeSiigoCustomer } from '../../../../../utils/siigo-customers'
import { siigoJson } from '../../../../../utils/siigo-persistence'
import {
  assertVoucherReferences,
  buildSiigoVoucherPayload,
  createOrderSiigoReceiptSchema,
  isSiigoInvoiceStamped,
  normalizeCostCenters,
  normalizeCreatedVoucher,
  normalizeInvoiceDetail,
  normalizePaymentTypes,
  normalizeVoucherDocumentTypes,
  siigoFiscalWritesEnabled
} from '../../../../../utils/siigo-vouchers'

function publicErrorMessage(error: unknown) {
  const value = error as { statusMessage?: string, message?: string }
  return (value.statusMessage || value.message || 'Siigo no pudo registrar la recepción.').slice(0, 2500)
}

function uncertainExternalResult(error: unknown) {
  const statusCode = (error as { statusCode?: number }).statusCode
  return !statusCode || statusCode >= 500
}

export default eventHandler(async (event): Promise<OrderPayment> => {
  const user = await requireRole(event, ORDER_LOGISTICS_ROLES)
  const orderId = getRouterParam(event, 'id')
  const paymentId = getRouterParam(event, 'paymentId')
  if (!orderId || !paymentId) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido o del pago.' })
  }

  const parsed = createOrderSiigoReceiptSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Revisa los datos de la recepción.',
      data: parsed.error.flatten()
    })
  }

  const [order, payment] = await Promise.all([
    getOrder(orderId, user),
    usePrisma().salesOrderPayment.findFirst({ where: { id: paymentId, orderId } })
  ])
  if (!payment) {
    throw createError({ statusCode: 404, statusMessage: 'No se encontró el pago.' })
  }
  if (!order.siigoReference) {
    throw createError({ statusCode: 409, statusMessage: 'Crea la factura del pedido antes de registrar el pago en Siigo.' })
  }
  if (parsed.data.invoiceId !== order.siigoReference) {
    throw createError({ statusCode: 422, statusMessage: 'Selecciona la factura asociada a este pedido.' })
  }
  if (!order.customer.rfc) {
    throw createError({ statusCode: 422, statusMessage: 'El cliente necesita RFC para registrar una recepción en Siigo.' })
  }
  if (payment.externalStatus === 'synced') return orderPaymentView(payment)
  if (payment.externalStatus === 'pending' || payment.externalStatus === 'unknown') {
    throw createError({
      statusCode: 409,
      statusMessage: 'El resultado de este pago en Siigo debe verificarse antes de intentar otra recepción.'
    })
  }
  if (payment.siigoVoucherId) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Este pago ya tiene una recepción creada en Siigo y no puede generar otra.'
    })
  }
  if (payment.provider !== 'local' && payment.externalStatus !== 'failed') {
    throw createError({ statusCode: 409, statusMessage: 'Este pago no se puede registrar nuevamente en Siigo.' })
  }
  if (!siigoFiscalWritesEnabled()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Las recepciones de Siigo están deshabilitadas hasta autorizar la escritura fiscal.'
    })
  }

  const input: CreateOrderSiigoPaymentInput = {
    destination: 'siigo',
    requestId: payment.requestId,
    invoiceId: parsed.data.invoiceId,
    documentTypeId: parsed.data.documentTypeId,
    voucherNumber: parsed.data.voucherNumber,
    paymentTypeId: parsed.data.paymentTypeId,
    costCenterId: parsed.data.costCenterId,
    cfdiCode: parsed.data.cfdiCode,
    paymentMethod: parsed.data.paymentMethod,
    quote: parsed.data.quote,
    amount: Number(payment.amount.toString()),
    date: payment.paymentDate.toISOString().slice(0, 10),
    observations: payment.observations,
    confirmation: 'CREAR_RECEPCION_SIIGO'
  }
  const appliedPayments = await usePrisma().salesOrderPayment.aggregate({
    where: {
      orderId,
      id: { not: payment.id },
      siigoInvoiceId: order.siigoReference,
      siigoVoucherId: { not: null }
    },
    _sum: { amount: true }
  })
  const appliedAmount = Number(appliedPayments._sum.amount?.toString() || 0)
  const ppdBalanceLimit = Math.max(0, order.total - appliedAmount)
  const [invoiceResponse, customerResponse, documentResponse, paymentResponse, costCenterResponse] = await Promise.all([
    siigoRequest<unknown>(`/v1/invoices/${encodeURIComponent(input.invoiceId)}`),
    siigoRequest<unknown>(`/v1/customers/${encodeURIComponent(order.customer.id)}`),
    siigoRequest<unknown>('/v1/document-types', { query: { type: 'RC' } }),
    siigoRequest<unknown>('/v1/payment-types', { query: { document_type: 'FV' } }),
    siigoRequest<unknown>('/v1/cost-centers')
  ])
  const invoice = normalizeInvoiceDetail(invoiceResponse, { ppdBalanceLimit })
  if (!isSiigoInvoiceStamped(invoice.stamp?.status)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'La factura debe estar timbrada en Siigo antes de registrar este pago.'
    })
  }
  const customer = normalizeSiigoCustomer(customerResponse as SiigoCustomerApiResponse)
  const customerRfc = customer.rfc_id || customer.identification
  if (!customerRfc || customerRfc !== order.customer.rfc) {
    throw createError({
      statusCode: 409,
      statusMessage: 'El RFC del cliente cambió en Siigo. Actualiza el pedido antes de registrar el pago.'
    })
  }

  const references = assertVoucherReferences({
    input,
    invoice,
    orderCustomerId: order.customer.id,
    orderCustomerRfc: order.customer.rfc,
    documentTypes: normalizeVoucherDocumentTypes(documentResponse),
    paymentTypes: normalizePaymentTypes(paymentResponse),
    costCenters: normalizeCostCenters(costCenterResponse)
  })
  const payload = buildSiigoVoucherPayload({ input, invoice, customerRfc, prefix: references.prefix })
  const reserved = await usePrisma().salesOrderPayment.updateMany({
    where: {
      id: payment.id,
      orderId,
      provider: payment.provider,
      externalStatus: payment.externalStatus
    },
    data: {
      provider: 'siigo',
      externalStatus: 'pending',
      externalError: null,
      siigoInvoiceId: invoice.id,
      siigoInvoiceName: invoice.name,
      siigoDocumentTypeId: input.documentTypeId,
      siigoPaymentTypeId: input.paymentTypeId,
      siigoCostCenterId: input.costCenterId ?? null,
      siigoCfdiCode: input.cfdiCode,
      siigoPaymentMethod: input.paymentMethod,
      siigoQuote: input.quote
    }
  })
  if (reserved.count !== 1) {
    throw createError({ statusCode: 409, statusMessage: 'El pago cambió mientras se preparaba la recepción. Actualiza e intenta de nuevo.' })
  }

  try {
    // Creación fiscal sin reintento automático.
    const created = normalizeCreatedVoucher(await siigoRequest<unknown>('/v1/vouchers', {
      method: 'POST',
      body: payload
    }))
    await usePrisma().salesOrderPayment.update({
      where: { id: payment.id },
      data: {
        siigoVoucherId: created.id,
        siigoVoucherName: created.name,
        externalPayload: siigoJson(created.raw)
      }
    })

    if (parsed.data.stamp) {
      // Siigo México exige un correo al timbrar. No se reintenta si la respuesta es ambigua.
      const stamped = await siigoRequest<unknown>(`/v1/vouchers/${encodeURIComponent(created.id)}/stamp`, {
        method: 'PUT',
        body: { mail_to: parsed.data.stampEmail }
      })
      return orderPaymentView(await usePrisma().salesOrderPayment.update({
        where: { id: payment.id },
        data: {
          externalStatus: 'synced',
          externalPayload: siigoJson({ created: created.raw, stamp: stamped })
        }
      }))
    }

    return orderPaymentView(await usePrisma().salesOrderPayment.update({
      where: { id: payment.id },
      data: {
        externalStatus: 'synced',
        externalPayload: siigoJson(created.raw)
      }
    }))
  } catch (error) {
    return orderPaymentView(await usePrisma().salesOrderPayment.update({
      where: { id: payment.id },
      data: {
        externalStatus: uncertainExternalResult(error) ? 'unknown' : 'failed',
        externalError: publicErrorMessage(error)
      }
    }))
  }
})
