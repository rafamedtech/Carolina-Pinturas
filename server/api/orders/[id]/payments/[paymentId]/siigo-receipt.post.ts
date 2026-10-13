import type { CreateOrderSiigoPaymentInput, OrderPayment } from '~/types/siigo-payments'
import { formatDate } from '#shared/utils/datetime'
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
  assertHistoricalReceiptMatchesPayment,
  assertSiigoReceiptStampResponse,
  buildSiigoVoucherPayload,
  createOrderSiigoReceiptSchema,
  isSiigoInvoiceStamped,
  isSiigoPpdInvoice,
  normalizeHistoricalReceiptDetail,
  normalizeCostCenters,
  normalizeCreatedVoucher,
  normalizeInvoiceDetail,
  normalizePaymentTypes,
  normalizeVoucherDocumentTypes,
  siigoReceiptCustomerEmail,
  siigoReceiptReconciliationDate,
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

function inputPaymentObservations(paymentDate: Date, receiptDate: string, observations: string | null) {
  const date = paymentDate.toISOString().slice(0, 10)
  if (date === receiptDate) return observations
  return `Pago registrado el ${formatDate(date)}. ${observations ?? ''}`.trim().slice(0, 2500)
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
  const resumeStamp = Boolean(payment.siigoVoucherId)
  if (resumeStamp !== (parsed.data.confirmation === 'ACTUALIZAR_Y_TIMBRAR_RECEPCION_SIIGO')) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Confirma la operación correspondiente: crear una recepción nueva o actualizar y timbrar la existente.'
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
    date: parsed.data.date,
    observations: inputPaymentObservations(payment.paymentDate, parsed.data.date, payment.observations),
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
  if (!isSiigoPpdInvoice(invoiceResponse)) {
    throw createError({ statusCode: 422, statusMessage: 'La factura debe tener método PPD para registrar una recepción de pago.' })
  }
  const customer = normalizeSiigoCustomer(customerResponse as SiigoCustomerApiResponse)
  if (customer.id !== order.customer.id || customer.active === false) {
    throw createError({ statusCode: 422, statusMessage: 'El cliente de la recepción no está disponible o está inactivo en Siigo.' })
  }
  const stampEmail = siigoReceiptCustomerEmail(customer)
  if (parsed.data.stamp && !stampEmail) {
    throw createError({ statusCode: 422, statusMessage: 'El cliente no tiene un correo válido en Siigo. Actualiza sus contactos en Siigo antes de timbrar.' })
  }
  const customerRfc = customer.rfc_id || customer.identification
  if (!customerRfc || customerRfc !== order.customer.rfc) {
    throw createError({
      statusCode: 409,
      statusMessage: 'El RFC del cliente cambió en Siigo. Actualiza el pedido antes de registrar el pago.'
    })
  }

  let existingReceipt: ReturnType<typeof normalizeHistoricalReceiptDetail> | null = null
  if (resumeStamp) {
    existingReceipt = normalizeHistoricalReceiptDetail(await siigoRequest<unknown>(`/v1/vouchers/${encodeURIComponent(payment.siigoVoucherId!)}`))
    assertHistoricalReceiptMatchesPayment(existingReceipt, {
      voucherId: payment.siigoVoucherId!,
      invoice,
      customerId: customer.id,
      customerRfc,
      amount: input.amount,
      date: siigoReceiptReconciliationDate(payment.externalPayload, payment.paymentDate)
    })
    if (isSiigoInvoiceStamped(existingReceipt.stampStatus)) {
      return orderPaymentView(await usePrisma().salesOrderPayment.update({
        where: { id: payment.id },
        data: { externalStatus: 'synced', externalError: null, externalPayload: siigoJson(existingReceipt.raw) }
      }))
    }
    if (existingReceipt.stampStatus?.toLowerCase() !== 'draft') {
      throw createError({ statusCode: 409, statusMessage: 'La recepción no está en borrador. Revisa su estado y errores en Siigo antes de volver a timbrar.' })
    }
    if (existingReceipt.applications.length !== 1
      || existingReceipt.documentTypeId !== input.documentTypeId
      || existingReceipt.paymentTypeId !== input.paymentTypeId
      || existingReceipt.cfdiCode !== input.cfdiCode
      || existingReceipt.paymentMethod !== input.paymentMethod
      || existingReceipt.customerBranchOffice !== (invoice.customer?.branch_office ?? 0)
      || existingReceipt.applications[0]?.quote !== input.quote
      || existingReceipt.costCenterId !== (input.costCenterId ?? null)) {
      throw createError({ statusCode: 409, statusMessage: 'Los datos de la recepción cambiaron en Siigo. Sólo se permite corregir la fecha y timbrar el mismo pago.' })
    }
  }
  const voucherInput = existingReceipt ? { ...input, voucherNumber: existingReceipt.number } : input
  const references = assertVoucherReferences({
    input: voucherInput,
    invoice: existingReceipt ? { ...invoice, balance: input.amount } : invoice,
    orderCustomerId: order.customer.id,
    orderCustomerRfc: order.customer.rfc,
    documentTypes: normalizeVoucherDocumentTypes(documentResponse),
    paymentTypes: normalizePaymentTypes(paymentResponse),
    costCenters: normalizeCostCenters(costCenterResponse)
  })
  const payload = buildSiigoVoucherPayload({
    input: voucherInput,
    invoice,
    customerRfc,
    prefix: references.prefix
  })
  if (existingReceipt) {
    if (existingReceipt.date !== input.date && !Number.isInteger(payload.number)) {
      throw createError({ statusCode: 409, statusMessage: 'Siigo no devolvió el consecutivo de la recepción. Corrige su fecha directamente en Siigo.' })
    }
    // Conservar UUID y demás referencias fiscales del documento consultado.
    payload.items = existingReceipt.applications.map(application => ({
      due: {
        prefix: application.prefix,
        consecutive: application.consecutive,
        quote: application.quote,
        ...(application.uuid ? { uuid: application.uuid } : {})
      },
      value: application.amount
    }))
  }
  const reserved = await usePrisma().salesOrderPayment.updateMany({
    where: {
      id: payment.id,
      orderId,
      provider: payment.provider,
      externalStatus: payment.externalStatus,
      siigoVoucherId: payment.siigoVoucherId
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
      siigoQuote: input.quote,
      externalPayload: siigoJson({ request: existingReceipt ? { ...payload, date: existingReceipt.date } : payload })
    }
  })
  if (reserved.count !== 1) {
    throw createError({ statusCode: 409, statusMessage: 'El pago cambió mientras se preparaba la recepción. Actualiza e intenta de nuevo.' })
  }

  try {
    // Creación fiscal sin reintento automático.
    const created = existingReceipt
      ? { id: existingReceipt.id, name: existingReceipt.name, raw: existingReceipt.raw }
      : normalizeCreatedVoucher(await siigoRequest<unknown>('/v1/vouchers', { method: 'POST', body: payload }))
    await usePrisma().salesOrderPayment.update({
      where: { id: payment.id },
      data: {
        siigoVoucherId: created.id,
        siigoVoucherName: created.name,
        externalPayload: siigoJson({ request: existingReceipt ? { ...payload, date: existingReceipt.date } : payload, created: created.raw })
      }
    })

    if (parsed.data.stamp) {
      if (existingReceipt && existingReceipt.date !== input.date) {
        await siigoRequest<unknown>(`/v1/vouchers/${encodeURIComponent(created.id)}`, { method: 'PUT', body: payload })
        await usePrisma().salesOrderPayment.update({
          where: { id: payment.id },
          data: { externalPayload: siigoJson({ request: payload, created: created.raw }) }
        })
      }
      // Siigo México exige un correo al timbrar. No se reintenta si la respuesta es ambigua.
      const stamped = await siigoRequest<unknown>(`/v1/vouchers/${encodeURIComponent(created.id)}/stamp`, {
        method: 'PUT',
        body: { mail_to: stampEmail }
      })
      assertSiigoReceiptStampResponse(stamped)
      return orderPaymentView(await usePrisma().salesOrderPayment.update({
        where: { id: payment.id },
        data: {
          externalStatus: 'synced',
          externalPayload: siigoJson({ request: payload, created: created.raw, stamp: stamped })
        }
      }))
    }

    return orderPaymentView(await usePrisma().salesOrderPayment.update({
      where: { id: payment.id },
      data: {
        externalStatus: 'synced',
        externalPayload: siigoJson({ request: payload, created: created.raw })
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
