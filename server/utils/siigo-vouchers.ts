import * as z from 'zod'
import type { SiigoInvoice, SiigoInvoiceDetail } from '~/types/siigo'
import type {
  CreateOrderSiigoReceiptInput,
  CreateOrderSiigoPaymentInput,
  SiigoCostCenter,
  SiigoPaymentType,
  SiigoPayableInvoice,
  SiigoVoucherDocumentType
} from '~/types/siigo-payments'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa una fecha con formato AAAA-MM-DD.')

export const createOrderSiigoPaymentSchema = z.object({
  destination: z.literal('siigo'),
  requestId: z.string().uuid(),
  invoiceId: z.string().uuid('Selecciona una factura válida.'),
  documentTypeId: z.number().int().positive(),
  voucherNumber: z.number().int().positive().nullable().optional(),
  paymentTypeId: z.number().int().positive(),
  costCenterId: z.number().int().positive().nullable().optional(),
  cfdiCode: z.string().trim().regex(/^[A-Za-z0-9]{2,8}$/, 'Selecciona una forma de pago CFDI válida.'),
  paymentMethod: z.enum(['PUE', 'PPD']),
  amount: z.number().positive('El importe debe ser mayor a cero.').max(9_999_999_999_999.99)
    .refine(value => Number(value.toFixed(2)) === value, 'El importe admite máximo dos decimales.'),
  date: dateSchema,
  quote: z.number().int().positive().max(10_000).default(1),
  observations: z.string().trim().max(2500).nullable().optional(),
  confirmation: z.literal('CREAR_RECEPCION_SIIGO')
})

export const createOrderSiigoReceiptSchema = createOrderSiigoPaymentSchema.omit({
  destination: true,
  requestId: true,
  amount: true,
  date: true,
  observations: true
}).strict() satisfies z.ZodType<CreateOrderSiigoReceiptInput>

export type CreateOrderSiigoPaymentData = z.output<typeof createOrderSiigoPaymentSchema>

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}

function string(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function number(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function boolean(value: unknown) {
  return typeof value === 'boolean' ? value : null
}

function catalogResults(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const results = record(value)?.results
  return Array.isArray(results) ? results : []
}

export function normalizeVoucherDocumentTypes(value: unknown): SiigoVoucherDocumentType[] {
  return catalogResults(value).flatMap((entry) => {
    const item = record(entry)
    const id = number(item?.id)
    const code = string(item?.code)
    const name = string(item?.name)
    if (!item || !id || !code || !name) return []

    return [{
      id,
      code,
      name,
      active: boolean(item.active) ?? false,
      cost_center: boolean(item.cost_center) ?? undefined,
      cost_center_mandatory: boolean(item.cost_center_mandatory) ?? undefined,
      cost_center_default: number(item.cost_center_default),
      automatic_number: boolean(item.automatic_number) ?? undefined,
      consecutive: number(item.consecutive) ?? undefined
    }]
  })
}

export function normalizePaymentTypes(value: unknown): SiigoPaymentType[] {
  return catalogResults(value).flatMap((entry) => {
    const item = record(entry)
    const id = number(item?.id)
    const name = string(item?.name)
    if (!item || !id || !name) return []

    return [{
      id,
      name,
      type: string(item.type) ?? undefined,
      active: boolean(item.active) ?? false,
      due_date: boolean(item.due_date) ?? undefined
    }]
  })
}

export function normalizeCostCenters(value: unknown): SiigoCostCenter[] {
  return catalogResults(value).flatMap((entry) => {
    const item = record(entry)
    const id = number(item?.id)
    const name = string(item?.name)
    if (!item || !id || !name) return []

    return [{
      id,
      name,
      active: boolean(item.active) ?? undefined
    }]
  })
}

function draftPpdOutstandingBalance(invoice: UnknownRecord) {
  const stamp = record(invoice.stamp)
  const payment = record(invoice.payment)
  const conditions = Array.isArray(payment?.conditions) ? payment.conditions : []
  if (string(stamp?.status)?.toLowerCase() !== 'draft' || string(payment?.method) !== 'PPD') return null

  const outstanding = conditions.reduce((total, condition) => {
    const value = number(record(condition)?.value)
    return value && value > 0 ? total + value : total
  }, 0)
  return outstanding > 0 ? outstanding : null
}

export function isSiigoInvoiceStamped(status: string | null | undefined) {
  return status?.trim().toLowerCase() === 'accepted'
}

export function normalizePayableInvoices(
  value: unknown,
  options: { draftPpdBalanceLimit?: number } = {}
): SiigoPayableInvoice[] {
  return catalogResults(value).flatMap((entry) => {
    const invoice = record(entry)
    const customer = record(invoice?.customer)
    const id = string(invoice?.id)
    const name = string(invoice?.name)
    const date = string(invoice?.date)
    const total = number(invoice?.total)
    const balance = number(invoice?.balance)
    const stampStatus = string(record(invoice?.stamp)?.status)
    if (!invoice || !id || !name || !date || total === null || balance === null) return []
    const draftBalance = balance <= 0 && options.draftPpdBalanceLimit
      ? draftPpdOutstandingBalance(invoice)
      : null
    const payableBalance = draftBalance
      ? Math.min(draftBalance, options.draftPpdBalanceLimit!)
      : balance

    return [{
      id,
      name,
      date,
      total,
      balance: payableBalance,
      customerId: string(customer?.id),
      customerRfc: string(customer?.rfc_id)
        ?? string(customer?.['rfc.id'])
        ?? string(customer?.identification),
      stampStatus,
      stamped: isSiigoInvoiceStamped(stampStatus)
    }]
  }).filter(invoice => invoice.balance > 0)
}

export function payableInvoicesForCustomer(
  value: unknown,
  options: {
    customerId: string
    customerRfc: string
    preferredInvoiceId?: string | null
    preferredInvoice?: unknown
    preferredBalance?: number
  }
) {
  const invoices = [
    ...normalizePayableInvoices(value),
    ...normalizePayableInvoices(
      { results: [options.preferredInvoice] },
      { draftPpdBalanceLimit: options.preferredBalance }
    )
  ]

  return [...new Map(invoices.map(invoice => [invoice.id, invoice])).values()]
    .filter(invoice =>
      invoice.customerId === options.customerId
      || invoice.customerRfc === options.customerRfc
    )
    .sort((left, right) =>
      Number(right.id === options.preferredInvoiceId)
      - Number(left.id === options.preferredInvoiceId)
    )
}

export function normalizeInvoiceDetail(
  value: unknown,
  options: { draftPpdBalanceLimit?: number } = {}
): SiigoInvoiceDetail {
  const invoice = record(value)
  const customer = record(invoice?.customer)
  const document = record(invoice?.document)
  const id = string(invoice?.id)
  const name = string(invoice?.name)
  const date = string(invoice?.date)
  const consecutive = number(invoice?.number)
  const total = number(invoice?.total)
  const balance = number(invoice?.balance)
  const customerId = string(customer?.id)
  const customerRfc = string(customer?.rfc_id) ?? string(customer?.identification)
  const stampStatus = string(record(invoice?.stamp)?.status)

  if (
    !invoice
    || !id
    || !name
    || !date
    || !Number.isInteger(consecutive)
    || !consecutive
    || total === null
    || balance === null
    || (!customerId && !customerRfc)
  ) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Siigo devolvió una factura incompleta para registrar el pago.'
    })
  }
  const draftBalance = balance <= 0 && options.draftPpdBalanceLimit
    ? draftPpdOutstandingBalance(invoice)
    : null

  return {
    id,
    name,
    date,
    number: consecutive,
    document: { id: number(document?.id) ?? undefined },
    total,
    balance: draftBalance
      ? Math.min(draftBalance, options.draftPpdBalanceLimit!)
      : balance,
    stamp: stampStatus ? { status: stampStatus } : undefined,
    customer: {
      id: customerId ?? undefined,
      identification: string(customer?.identification) ?? undefined,
      rfc_id: string(customer?.rfc_id) ?? undefined,
      branch_office: number(customer?.branch_office) ?? 0
    }
  }
}

export function invoicePrefix(invoice: Pick<SiigoInvoice, 'name' | 'number'>) {
  if (!invoice.name || !Number.isInteger(invoice.number) || Number(invoice.number) <= 0) {
    throw createError({
      statusCode: 422,
      statusMessage: 'La factura de Siigo no incluye nombre y consecutivo válidos.'
    })
  }

  const suffix = `-${invoice.number}`
  if (!invoice.name.endsWith(suffix) || invoice.name.length <= suffix.length) {
    throw createError({
      statusCode: 422,
      statusMessage: 'No se pudo determinar el prefijo de la factura seleccionada.'
    })
  }

  return invoice.name.slice(0, -suffix.length)
}

export function assertVoucherReferences(options: {
  input: CreateOrderSiigoPaymentInput
  invoice: SiigoInvoiceDetail
  orderCustomerId: string
  orderCustomerRfc: string | null
  documentTypes: SiigoVoucherDocumentType[]
  paymentTypes: SiigoPaymentType[]
  costCenters: SiigoCostCenter[]
}) {
  const { input, invoice } = options
  const customerMatches = invoice.customer?.id === options.orderCustomerId
    || Boolean(
      options.orderCustomerRfc
      && (invoice.customer?.rfc_id === options.orderCustomerRfc
        || invoice.customer?.identification === options.orderCustomerRfc)
    )

  if (!customerMatches) {
    throw createError({ statusCode: 422, statusMessage: 'La factura seleccionada pertenece a otro cliente.' })
  }
  if (!invoice.balance || invoice.balance <= 0 || input.amount > invoice.balance) {
    throw createError({ statusCode: 422, statusMessage: 'El importe supera el saldo pendiente de la factura.' })
  }

  const documentType = options.documentTypes.find(item => item.id === input.documentTypeId && item.active)
  if (!documentType) {
    throw createError({ statusCode: 422, statusMessage: 'El tipo de recepción ya no está activo en Siigo.' })
  }
  if (documentType.automatic_number === false && !input.voucherNumber) {
    throw createError({ statusCode: 422, statusMessage: 'Captura el consecutivo para este tipo de recepción.' })
  }
  if (documentType.cost_center_mandatory && !input.costCenterId) {
    throw createError({ statusCode: 422, statusMessage: 'Selecciona el centro de costo requerido por el comprobante.' })
  }
  if (input.costCenterId && !options.costCenters.some(item => item.id === input.costCenterId && item.active !== false)) {
    throw createError({ statusCode: 422, statusMessage: 'El centro de costo ya no está activo en Siigo.' })
  }
  if (!options.paymentTypes.some(item => item.id === input.paymentTypeId && item.active)) {
    throw createError({ statusCode: 422, statusMessage: 'La condición de pago ya no está activa en Siigo.' })
  }

  return { documentType, prefix: invoicePrefix(invoice) }
}

export function buildSiigoVoucherPayload(options: {
  input: CreateOrderSiigoPaymentInput
  invoice: SiigoInvoiceDetail
  customerRfc: string
  prefix: string
}) {
  const { input, invoice } = options
  if (!invoice.number) {
    throw createError({ statusCode: 422, statusMessage: 'La factura no incluye un consecutivo válido.' })
  }

  return {
    document: { id: input.documentTypeId },
    ...(input.voucherNumber ? { number: input.voucherNumber } : {}),
    date: input.date,
    // Contrato oficial de México consultado el 2026-07-28: la tabla describe
    // customer.rfc_id, pero el request schema y el ejemplo usan la clave literal
    // "rfc.id". Se conserva la forma del request hasta validarla en tenant seguro.
    customer: {
      'rfc.id': options.customerRfc,
      'branch_office': invoice.customer?.branch_office ?? 0
    },
    ...(input.costCenterId ? { cost_center: input.costCenterId } : {}),
    items: [{
      due: {
        prefix: options.prefix,
        consecutive: invoice.number,
        quote: input.quote
      },
      value: input.amount
    }],
    payment: {
      method: input.paymentMethod,
      cfdi: input.cfdiCode,
      conditions: [{
        id: input.paymentTypeId,
        value: input.amount
      }]
    },
    ...(input.observations ? { observations: input.observations } : {})
  }
}

export function normalizeCreatedVoucher(value: unknown) {
  const voucher = record(value)
  const id = string(voucher?.id)
  if (!voucher || !id || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Siigo creó una respuesta de recepción con un identificador inválido.'
    })
  }

  return {
    id,
    name: string(voucher.name),
    raw: voucher
  }
}

export function siigoFiscalWritesEnabled() {
  const value = useRuntimeConfig().siigo.fiscalWritesEnabled as boolean | string
  return value === true || value === 'true'
}
