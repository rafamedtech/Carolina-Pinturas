import Decimal from 'decimal.js'
import * as z from 'zod'
import type { SiigoCustomer, SiigoProduct } from '~/types/siigo'
import type {
  AssignHistoricalSiigoInvoiceInput,
  CreateOrderSiigoInvoiceInput,
  HistoricalSiigoInvoiceOption,
  SiigoInvoiceDocumentType,
  SiigoSeller,
  SiigoWarehouse
} from '~/types/siigo-invoices'
import type { SiigoCostCenter, SiigoPaymentType } from '~/types/siigo-payments'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa una fecha con formato AAAA-MM-DD.')

export const createOrderSiigoInvoiceSchema = z.object({
  documentTypeId: z.number().int().positive(),
  invoiceNumber: z.number().int().positive().nullable().optional(),
  sellerId: z.number().int().positive(),
  paymentTypeId: z.number().int().positive(),
  costCenterId: z.number().int().positive().nullable().optional(),
  warehouseId: z.number().int().positive().nullable().optional(),
  useCfdi: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,8}$/, 'Captura un uso CFDI válido.'),
  paymentMethod: z.literal('PPD'),
  date: dateSchema,
  dueDate: dateSchema,
  confirmation: z.literal('CREAR_BORRADOR_SIIGO')
})

export const assignHistoricalSiigoInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  confirmation: z.literal('ASIGNAR_FACTURA_HISTORICA')
}) satisfies z.ZodType<AssignHistoricalSiigoInvoiceInput>

export function isSiigoInvoiceWriteEnabled(value: boolean | string | null | undefined) {
  return value === true || value === 'true'
}

export function siigoInvoiceWritesEnabled() {
  return isSiigoInvoiceWriteEnabled(
    useRuntimeConfig().siigo.invoiceWritesEnabled as boolean | string | null | undefined
  )
}

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
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function totalsMatch(left: number, right: number) {
  return Math.abs(Math.round(left * 100) - Math.round(right * 100)) <= 1
}

function customerMatches(
  invoice: { id: string | null, rfc: string | null },
  order: { id: string, rfc: string }
) {
  return invoice.id === order.id
    || invoice.rfc?.toUpperCase() === order.rfc.trim().toUpperCase()
}

function boolean(value: unknown) {
  return typeof value === 'boolean' ? value : null
}

function catalogResults(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const results = record(value)?.results
  return Array.isArray(results) ? results : []
}

export function normalizeInvoiceDocumentTypes(value: unknown): SiigoInvoiceDocumentType[] {
  return catalogResults(value).flatMap((entry) => {
    const item = record(entry)
    const id = number(item?.id)
    const code = string(item?.code)
    const name = string(item?.name)
    const discountType = string(item?.discount_type)
    if (!item || !id || !code || !name || (discountType !== 'Percentage' && discountType !== 'Value')) {
      return []
    }

    return [{
      id,
      code,
      name,
      active: boolean(item.active) ?? false,
      cost_center: boolean(item.cost_center) ?? undefined,
      cost_center_mandatory: boolean(item.cost_center_mandatory) ?? undefined,
      cost_center_default: number(item.cost_center_default),
      automatic_number: boolean(item.automatic_number) ?? undefined,
      consecutive: number(item.consecutive) ?? undefined,
      discount_type: discountType
    }]
  })
}

export function normalizeSiigoSellers(value: unknown): SiigoSeller[] {
  return catalogResults(value).flatMap((entry) => {
    const item = record(entry)
    const id = number(item?.id)
    if (!item || !id) return []

    const firstName = string(item.first_name)
    const lastName = string(item.last_name)
    const email = string(item.email) ?? string(item.username)
    const name = [firstName, lastName].filter(Boolean).join(' ') || email
    if (!name) return []

    return [{
      id,
      name,
      email,
      active: boolean(item.active) ?? false
    }]
  })
}

export function normalizeInvoicePaymentTypes(value: unknown): SiigoPaymentType[] {
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

export function normalizeInvoiceCostCenters(value: unknown): SiigoCostCenter[] {
  return catalogResults(value).flatMap((entry) => {
    const item = record(entry)
    const id = number(item?.id)
    const name = string(item?.name)
    if (!item || !id || !name) return []

    return [{ id, name, active: boolean(item.active) ?? undefined }]
  })
}

export function normalizeSiigoWarehouses(value: unknown): SiigoWarehouse[] {
  return catalogResults(value).flatMap((entry) => {
    const item = record(entry)
    const id = number(item?.id)
    const name = string(item?.name)
    if (!item || !id || !name) return []

    return [{ id, name, active: boolean(item.active) ?? false }]
  })
}

export function normalizeInvoiceProduct(value: unknown): SiigoProduct {
  const product = record(value)
  const id = string(product?.id)
  const code = string(product?.code)
  const name = string(product?.name)
  if (!product || !id || !code || !name) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Siigo devolvió un producto incompleto para crear la factura.'
    })
  }
  const taxes = Array.isArray(product.taxes)
    ? product.taxes.flatMap((entry) => {
        const tax = record(entry)
        const taxId = number(tax?.id)
        if (!tax || !taxId || !Number.isInteger(taxId)) return []
        return [{
          id: taxId,
          name: string(tax.name) ?? undefined,
          percentage: number(tax.percentage) ?? undefined,
          type: string(tax.type) ?? undefined
        }]
      })
    : []

  return {
    id,
    code,
    name,
    active: boolean(product.active) ?? undefined,
    taxes
  }
}

export function isUsableFiscalRfc(value: string | null | undefined) {
  const rfc = value?.trim().toUpperCase() || ''
  return /^(?:[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}|[A-ZÑ&]{4}\d{6}[A-Z0-9]{3})$/.test(rfc)
    && rfc !== 'XAXX010101000'
    && rfc !== 'XEXX010101000'
}

export function missingInvoiceCustomerFields(customer: SiigoCustomer) {
  const missing: string[] = []

  if (customer.active === false) missing.push('cliente activo')
  if (!isUsableFiscalRfc(customer.rfc_id || customer.identification)) missing.push('RFC fiscal válido')

  return missing
}

export function normalizeHistoricalInvoiceOptions(
  value: unknown,
  options: { customerId: string, customerRfc: string, orderTotal: number }
): HistoricalSiigoInvoiceOption[] {
  return catalogResults(value).flatMap((entry) => {
    const invoice = record(entry)
    const customer = record(invoice?.customer)
    const stamp = record(invoice?.stamp)
    const id = string(invoice?.id)
    const name = string(invoice?.name)
    const date = string(invoice?.date)
    const total = number(invoice?.total)
    const stampStatus = string(stamp?.status)
    const customerId = string(customer?.id)
    const customerRfc = string(customer?.rfc_id)
      ?? string(customer?.['rfc.id'])
      ?? string(customer?.identification)

    if (
      !id
      || !name
      || !date
      || total === null
      || stampStatus?.toLowerCase() !== 'accepted'
      || !customerMatches(
        { id: customerId, rfc: customerRfc },
        { id: options.customerId, rfc: options.customerRfc }
      )
      || !totalsMatch(total, options.orderTotal)
    ) return []

    return [{ id, name, date, total, stampStatus }]
  }).sort((left, right) => right.date.localeCompare(left.date))
}

export function normalizeHistoricalInvoiceDetail(value: unknown) {
  const invoice = record(value)
  const customer = record(invoice?.customer)
  const document = record(invoice?.document)
  const stamp = record(invoice?.stamp)
  const use = record(invoice?.use)
  const payment = record(invoice?.payment)
  const conditions = Array.isArray(payment?.conditions) ? payment.conditions : []
  const condition = record(conditions[0])
  const items = Array.isArray(invoice?.items) ? invoice.items : []
  const warehouse = record(record(items[0])?.warehouse)
  const id = string(invoice?.id)
  const name = string(invoice?.name)
  const date = string(invoice?.date)
  const total = number(invoice?.total)
  const invoiceNumber = number(invoice?.number)
  const documentTypeId = number(document?.id)
  const sellerId = number(invoice?.seller)
  const paymentTypeId = number(condition?.id)
  const useCfdi = string(use?.code)
  const paymentMethod = string(payment?.method)
  const customerId = string(customer?.id)
  const customerRfc = string(customer?.rfc_id) ?? string(customer?.identification)
  const stampStatus = string(stamp?.status)
  const dueDate = string(condition?.due_date) ?? date

  if (
    !invoice
    || !id
    || !name
    || !date
    || !dateSchema.safeParse(date).success
    || !dueDate
    || !dateSchema.safeParse(dueDate).success
    || total === null
    || !documentTypeId
    || !sellerId
    || !paymentTypeId
    || !useCfdi
    || (paymentMethod !== 'PUE' && paymentMethod !== 'PPD')
    || (!customerId && !customerRfc)
    || !stampStatus
  ) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Siigo devolvió una factura incompleta para asociarla al pedido.'
    })
  }

  return {
    id,
    name,
    date,
    dueDate,
    total,
    invoiceNumber: invoiceNumber && Number.isInteger(invoiceNumber) ? invoiceNumber : null,
    documentTypeId,
    sellerId,
    paymentTypeId,
    costCenterId: number(invoice.cost_center),
    warehouseId: number(warehouse?.id),
    useCfdi,
    paymentMethod,
    customerId,
    customerRfc,
    stampStatus,
    raw: invoice
  }
}

export function assertHistoricalInvoiceMatchesOrder(
  invoice: ReturnType<typeof normalizeHistoricalInvoiceDetail>,
  order: { customerId: string, customerRfc: string, total: number }
) {
  if (invoice.stampStatus.toLowerCase() !== 'accepted') {
    throw createError({ statusCode: 422, statusMessage: 'Solo puedes asignar una factura timbrada en Siigo.' })
  }
  if (!customerMatches(
    { id: invoice.customerId, rfc: invoice.customerRfc },
    { id: order.customerId, rfc: order.customerRfc }
  )) {
    throw createError({ statusCode: 422, statusMessage: 'La factura seleccionada pertenece a otro cliente.' })
  }
  if (!totalsMatch(invoice.total, order.total)) {
    throw createError({ statusCode: 422, statusMessage: 'El total de la factura no coincide con el total del pedido.' })
  }
}

export function assertInvoiceReferences(options: {
  input: CreateOrderSiigoInvoiceInput
  documentTypes: SiigoInvoiceDocumentType[]
  sellers: SiigoSeller[]
  paymentTypes: SiigoPaymentType[]
  costCenters: SiigoCostCenter[]
  warehouses: SiigoWarehouse[]
}) {
  const { input } = options
  const documentType = options.documentTypes.find(item => item.id === input.documentTypeId && item.active)
  if (!documentType) {
    throw createError({ statusCode: 422, statusMessage: 'El tipo de factura ya no está activo en Siigo.' })
  }
  if (documentType.automatic_number === false && !input.invoiceNumber) {
    throw createError({ statusCode: 422, statusMessage: 'Captura el consecutivo para este tipo de factura.' })
  }
  if (!options.sellers.some(item => item.id === input.sellerId && item.active)) {
    throw createError({ statusCode: 422, statusMessage: 'El vendedor ya no está activo en Siigo.' })
  }
  const paymentType = options.paymentTypes.find(item => item.id === input.paymentTypeId && item.active)
  if (!paymentType) {
    throw createError({ statusCode: 422, statusMessage: 'La condición de pago ya no está activa en Siigo.' })
  }
  if (documentType.cost_center_mandatory && !input.costCenterId && !documentType.cost_center_default) {
    throw createError({ statusCode: 422, statusMessage: 'Selecciona el centro de costo requerido por la factura.' })
  }
  const costCenterId = input.costCenterId ?? documentType.cost_center_default
  if (costCenterId && !options.costCenters.some(item => item.id === costCenterId && item.active !== false)) {
    throw createError({ statusCode: 422, statusMessage: 'El centro de costo ya no está activo en Siigo.' })
  }
  if (input.warehouseId && !options.warehouses.some(item => item.id === input.warehouseId && item.active)) {
    throw createError({ statusCode: 422, statusMessage: 'La bodega ya no está activa en Siigo.' })
  }
  if (input.dueDate < input.date) {
    throw createError({ statusCode: 422, statusMessage: 'La fecha de vencimiento no puede ser anterior a la factura.' })
  }

  return { documentType, paymentType, costCenterId: costCenterId ?? null }
}

interface InvoiceOrderLine {
  code: string
  description: string | null
  quantity: number
  unitPrice: number
  discountAmount: number
  subtotal: number
  taxAmount: number
  total: number
}

interface InvoiceOrderSource {
  folio: number
  observations: string | null
  discountAmount: number
  total: number
  items: InvoiceOrderLine[]
}

function money(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
}

function invoiceDiscount(options: {
  line: InvoiceOrderLine
  orderDiscount: Decimal
  linesTotal: Decimal
  discountType: 'Percentage' | 'Value'
}) {
  const base = new Decimal(options.line.subtotal)
  const taxRate = options.line.subtotal > options.line.discountAmount
    ? new Decimal(options.line.taxAmount).div(new Decimal(options.line.subtotal).minus(options.line.discountAmount))
    : new Decimal(0)
  const allocatedWithTax = options.linesTotal.isZero()
    ? new Decimal(0)
    : options.orderDiscount.mul(options.line.total).div(options.linesTotal)
  const allocatedBeforeTax = allocatedWithTax.div(taxRate.plus(1))
  const discountValue = new Decimal(options.line.discountAmount).plus(allocatedBeforeTax)

  if (discountValue.lte(0)) return undefined
  if (options.discountType === 'Value') return money(discountValue).toNumber()
  if (base.lte(0)) return undefined
  return money(discountValue.mul(100).div(base)).toNumber()
}

export function buildSiigoInvoiceDraftPayload(options: {
  input: CreateOrderSiigoInvoiceInput
  order: InvoiceOrderSource
  customerRfc: string
  customerBranchOffice?: number | null
  products: Map<string, SiigoProduct>
  documentType: SiigoInvoiceDocumentType
  costCenterId: number | null
}) {
  const linesTotal = options.order.items.reduce((sum, item) => sum.plus(item.total), new Decimal(0))
  const items = options.order.items.map((line) => {
    const product = options.products.get(line.code)
    if (!product || product.active === false || product.code !== line.code) {
      throw createError({ statusCode: 409, statusMessage: `El producto ${line.code} ya no está activo en Siigo.` })
    }
    const quantity = money(line.quantity)
    const listedPrice = money(line.unitPrice)
    if (!quantity.equals(line.quantity) || !listedPrice.equals(line.unitPrice)) {
      throw createError({
        statusCode: 422,
        statusMessage: `El producto ${line.code} debe usar cantidad y precio con máximo dos decimales para facturarse.`
      })
    }
    // `unitPrice` conserva el precio mostrado al usuario y puede incluir IVA.
    // Siigo vuelve a calcular los impuestos enviados en `taxes`, por lo que la
    // factura debe recibir el valor unitario de la base antes de impuestos.
    const price = money(new Decimal(line.subtotal).div(quantity))
    const discount = invoiceDiscount({
      line,
      orderDiscount: new Decimal(options.order.discountAmount),
      linesTotal,
      discountType: options.documentType.discount_type
    })
    const taxes = (product.taxes || []).flatMap((tax) => {
      const id = number(tax.id)
      return id && Number.isInteger(id) ? [{ id }] : []
    })

    return {
      code: product.code,
      ...(line.description ? { description: line.description } : {}),
      quantity: quantity.toNumber(),
      price: price.toNumber(),
      ...(discount !== undefined ? { discount } : {}),
      ...(taxes.length ? { taxes } : {}),
      ...(options.input.warehouseId ? { warehouse: options.input.warehouseId } : {})
    }
  })
  const observations = [`Pedido PED-${String(options.order.folio).padStart(6, '0')}`, options.order.observations]
    .filter(Boolean)
    .join(' · ')
    .slice(0, 4000)

  return {
    document: { id: options.input.documentTypeId },
    ...(options.input.invoiceNumber ? { number: options.input.invoiceNumber } : {}),
    date: options.input.date,
    customer: {
      rfc_id: options.customerRfc,
      branch_office: options.customerBranchOffice ?? 0
    },
    seller: options.input.sellerId,
    use: options.input.useCfdi,
    ...(options.costCenterId ? { cost_center: options.costCenterId } : {}),
    observations,
    items,
    stamp: { send: false },
    mail: { send: false },
    payment: {
      method: options.input.paymentMethod,
      // Siigo México exige un arreglo aunque la tabla descriptiva de la
      // documentación presente los campos como payment.conditions.id/value.
      conditions: [{
        id: options.input.paymentTypeId,
        value: money(options.order.total).toNumber(),
        due_date: options.input.dueDate
      }]
    }
  }
}

export function normalizeCreatedInvoice(value: unknown) {
  const invoice = record(value)
  const id = string(invoice?.id)
  if (!invoice || !id || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Siigo devolvió una factura creada sin un identificador válido.'
    })
  }

  return {
    id,
    name: string(invoice.name),
    total: number(invoice.total),
    raw: invoice
  }
}
