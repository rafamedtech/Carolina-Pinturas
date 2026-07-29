import type { AppUser } from '~/types/siigo'
import type { CreateLocalOrderPaymentInput, CreateOrderSiigoPaymentInput, OrderPayment } from '~/types/siigo-payments'
import type { Prisma } from '../../../../../generated/prisma/client'
import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../../utils/auth'
import { getOrder } from '../../../../utils/orders'
import {
  assertPaymentFitsBalance,
  createOrderPaymentSchema,
  orderPaymentView,
  paymentDestinationForOrder,
  paymentMethodFromCfdi,
  paymentStatus
} from '../../../../utils/order-payments'
import { usePrisma } from '../../../../utils/prisma'
import { siigoRequest } from '../../../../utils/siigo'
import type { SiigoCustomerApiResponse } from '../../../../utils/siigo-customers'
import { normalizeSiigoCustomer } from '../../../../utils/siigo-customers'
import { siigoJson } from '../../../../utils/siigo-persistence'
import {
  assertVoucherReferences,
  buildSiigoVoucherPayload,
  normalizeCostCenters,
  normalizeCreatedVoucher,
  normalizeInvoiceDetail,
  normalizePaymentTypes,
  normalizeVoucherDocumentTypes,
  siigoFiscalWritesEnabled
} from '../../../../utils/siigo-vouchers'

const PAYMENT_TRANSACTION_OPTIONS = {
  isolationLevel: 'Serializable' as const,
  maxWait: 5_000,
  timeout: 15_000
}

function date(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

function errorMessage(error: unknown) {
  const value = error as { statusMessage?: string, message?: string }
  return (value.statusMessage || value.message || 'Siigo no pudo registrar la recepción.').slice(0, 2500)
}

function uncertainExternalResult(error: unknown) {
  const statusCode = (error as { statusCode?: number }).statusCode
  return !statusCode || statusCode >= 500
}

async function existingPayment(requestId: string, orderId: string) {
  const payment = await usePrisma().salesOrderPayment.findUnique({ where: { requestId } })
  if (payment && payment.orderId !== orderId) {
    throw createError({ statusCode: 409, statusMessage: 'La clave de idempotencia ya pertenece a otro pedido.' })
  }
  return payment
}

async function updateOrderSummary(
  tx: Prisma.TransactionClient,
  orderId: string,
  orderTotal: number,
  paymentMethod: string,
  paymentDate: Date,
  user: AppUser
) {
  const totals = await tx.salesOrderPayment.aggregate({
    where: { orderId },
    _sum: { amount: true }
  })
  const totalPaid = Number(totals._sum.amount?.toString() || 0)
  await tx.salesOrder.update({
    where: { id: orderId },
    data: {
      paymentStatus: paymentStatus(totalPaid, orderTotal),
      paymentMethod,
      paymentDate,
      updatedByEmail: user.email,
      version: { increment: 1 }
    }
  })
}

async function createLocalPayment(options: {
  orderId: string
  orderTotal: number
  currencyCode: string
  input: CreateLocalOrderPaymentInput
  user: AppUser
}) {
  return usePrisma().$transaction(async (tx) => {
    const duplicate = await tx.salesOrderPayment.findUnique({ where: { requestId: options.input.requestId } })
    if (duplicate) return duplicate

    const totals = await tx.salesOrderPayment.aggregate({
      where: { orderId: options.orderId },
      _sum: { amount: true }
    })
    const paidTotal = Number(totals._sum.amount?.toString() || 0)
    assertPaymentFitsBalance(options.input.amount, paidTotal, options.orderTotal)

    const payment = await tx.salesOrderPayment.create({
      data: {
        requestId: options.input.requestId,
        orderId: options.orderId,
        provider: 'local',
        externalStatus: 'not_applicable',
        paymentMethod: options.input.paymentMethod,
        amount: options.input.amount,
        currencyCode: options.currencyCode,
        paymentDate: date(options.input.date),
        reference: options.input.reference || null,
        observations: options.input.observations || null,
        createdByName: options.user.name,
        createdByEmail: options.user.email,
        createdByRole: options.user.role
      }
    })
    await updateOrderSummary(
      tx,
      options.orderId,
      options.orderTotal,
      options.input.paymentMethod,
      date(options.input.date),
      options.user
    )
    return payment
  }, PAYMENT_TRANSACTION_OPTIONS)
}

async function reserveSiigoPayment(options: {
  orderId: string
  orderTotal: number
  currencyCode: string
  invoice: ReturnType<typeof normalizeInvoiceDetail>
  input: CreateOrderSiigoPaymentInput
  user: AppUser
}) {
  return usePrisma().$transaction(async (tx) => {
    const duplicate = await tx.salesOrderPayment.findUnique({ where: { requestId: options.input.requestId } })
    if (duplicate) return { payment: duplicate, reserved: false }

    const totals = await tx.salesOrderPayment.aggregate({
      where: { orderId: options.orderId },
      _sum: { amount: true }
    })
    const paidTotal = Number(totals._sum.amount?.toString() || 0)
    assertPaymentFitsBalance(options.input.amount, paidTotal, options.orderTotal)

    const method = paymentMethodFromCfdi(options.input.cfdiCode)
    const payment = await tx.salesOrderPayment.create({
      data: {
        requestId: options.input.requestId,
        orderId: options.orderId,
        provider: 'siigo',
        externalStatus: 'pending',
        paymentMethod: method,
        amount: options.input.amount,
        currencyCode: options.currencyCode,
        paymentDate: date(options.input.date),
        observations: options.input.observations || null,
        siigoInvoiceId: options.invoice.id,
        siigoInvoiceName: options.invoice.name,
        siigoDocumentTypeId: options.input.documentTypeId,
        siigoPaymentTypeId: options.input.paymentTypeId,
        siigoCostCenterId: options.input.costCenterId ?? null,
        siigoCfdiCode: options.input.cfdiCode,
        siigoPaymentMethod: options.input.paymentMethod,
        siigoQuote: options.input.quote,
        createdByName: options.user.name,
        createdByEmail: options.user.email,
        createdByRole: options.user.role
      }
    })
    await updateOrderSummary(
      tx,
      options.orderId,
      options.orderTotal,
      method,
      date(options.input.date),
      options.user
    )
    return { payment, reserved: true }
  }, PAYMENT_TRANSACTION_OPTIONS)
}

export default eventHandler(async (event): Promise<OrderPayment> => {
  const user = await requireRole(event, ORDER_LOGISTICS_ROLES)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido.' })
  }

  const parsed = createOrderPaymentSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Revisa los datos del pago.',
      data: parsed.error.flatten()
    })
  }

  const order = await getOrder(id, user)
  if (order.status.key === 'borrador') {
    throw createError({ statusCode: 409, statusMessage: 'Convierte la cotización en pedido antes de registrar un pago.' })
  }

  const duplicate = await existingPayment(parsed.data.requestId, id)
  if (duplicate) return orderPaymentView(duplicate)

  const destination = paymentDestinationForOrder(order.requiresInvoice)
  if (parsed.data.destination !== destination) {
    throw createError({
      statusCode: 422,
      statusMessage: order.requiresInvoice
        ? 'Este pedido requiere factura; el pago debe registrarse en PostgreSQL y como recepción en Siigo.'
        : 'Este pedido no requiere factura; el pago debe registrarse únicamente en PostgreSQL.'
    })
  }

  if (parsed.data.destination === 'local') {
    return orderPaymentView(await createLocalPayment({
      orderId: id,
      orderTotal: order.total,
      currencyCode: order.currencyCode,
      input: parsed.data,
      user
    }))
  }

  if (!order.customer.rfc) {
    throw createError({ statusCode: 422, statusMessage: 'El cliente necesita RFC para registrar una recepción en Siigo.' })
  }
  if (!siigoFiscalWritesEnabled()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Las recepciones de Siigo están deshabilitadas hasta validar el contrato fiscal en un tenant seguro.'
    })
  }

  const [invoiceResponse, customerResponse, documentResponse, paymentResponse, costCenterResponse] = await Promise.all([
    siigoRequest<unknown>(`/v1/invoices/${encodeURIComponent(parsed.data.invoiceId)}`),
    siigoRequest<unknown>(`/v1/customers/${encodeURIComponent(order.customer.id)}`),
    siigoRequest<unknown>('/v1/document-types', { query: { type: 'RC' } }),
    siigoRequest<unknown>('/v1/payment-types', { query: { document_type: 'FV' } }),
    siigoRequest<unknown>('/v1/cost-centers')
  ])
  const invoice = normalizeInvoiceDetail(invoiceResponse)
  const customer = normalizeSiigoCustomer(customerResponse as SiigoCustomerApiResponse)
  const customerRfc = customer.rfc_id || customer.identification
  if (!customerRfc || customerRfc !== order.customer.rfc) {
    throw createError({
      statusCode: 409,
      statusMessage: 'El RFC del cliente cambió en Siigo. Actualiza el pedido antes de registrar el pago.'
    })
  }

  const references = assertVoucherReferences({
    input: parsed.data,
    invoice,
    orderCustomerId: order.customer.id,
    orderCustomerRfc: order.customer.rfc,
    documentTypes: normalizeVoucherDocumentTypes(documentResponse),
    paymentTypes: normalizePaymentTypes(paymentResponse),
    costCenters: normalizeCostCenters(costCenterResponse)
  })
  const payload = buildSiigoVoucherPayload({
    input: parsed.data,
    invoice,
    customerRfc,
    prefix: references.prefix
  })
  const reservation = await reserveSiigoPayment({
    orderId: id,
    orderTotal: order.total,
    currencyCode: order.currencyCode,
    invoice,
    input: parsed.data,
    user
  })
  if (!reservation.reserved) return orderPaymentView(reservation.payment)

  try {
    // Operación fiscal: una sola llamada, sin reintento automático.
    const created = normalizeCreatedVoucher(await siigoRequest<unknown>('/v1/vouchers', {
      method: 'POST',
      body: payload
    }))
    const payment = await usePrisma().salesOrderPayment.update({
      where: { id: reservation.payment.id },
      data: {
        externalStatus: 'synced',
        externalError: null,
        siigoVoucherId: created.id,
        siigoVoucherName: created.name,
        externalPayload: siigoJson(created.raw)
      }
    })
    return orderPaymentView(payment)
  } catch (error) {
    const payment = await usePrisma().salesOrderPayment.update({
      where: { id: reservation.payment.id },
      data: {
        externalStatus: uncertainExternalResult(error) ? 'unknown' : 'failed',
        externalError: errorMessage(error)
      }
    })
    return orderPaymentView(payment)
  }
})
