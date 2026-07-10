import * as z from 'zod'
import { PAYMENT_STATUS_KEYS, PAYMENT_METHOD_KEYS } from '~/utils/orderPayment'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa una fecha con formato AAAA-MM-DD.')

export const DISCOUNT_TYPES = ['porcentaje', 'monto'] as const

const discountFields = {
  discountType: z.enum(DISCOUNT_TYPES).default('porcentaje'),
  discountValue: z.number().min(0, 'El descuento no puede ser negativo.').max(100_000_000).default(0)
}

function validateDiscount(
  data: { discountType: string, discountValue: number },
  ctx: z.RefinementCtx,
  basePath: (string | number)[] = []
) {
  if (data.discountType === 'porcentaje' && data.discountValue > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...basePath, 'discountValue'],
      message: 'El descuento porcentual no puede ser mayor a 100%.'
    })
  }
}

// A repartidor is optional while the order is in borrador/ingresado; it becomes
// mandatory once the order reaches confirmado (or a later igualación state).
export const STATUS_KEYS_REQUIRING_REPARTIDOR = ['confirmado', 'surtido', 'en_espera']

const orderFieldsSchema = z.object({
  customerId: z.string().uuid('Selecciona un cliente válido.'),
  repartidorId: z.string().uuid('Selecciona un repartidor válido.').nullish(),
  statusKey: z.string().trim().min(1).max(32).default('ingresado'),
  orderDate: dateSchema,
  promisedDate: dateSchema.nullable().optional(),
  observations: z.string().trim().max(5000).nullable().optional(),
  remision: z.string().trim().max(100).nullable().optional(),
  requiresInvoice: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  paymentStatus: z.enum(PAYMENT_STATUS_KEYS as [string, ...string[]]).default('pendiente_pago'),
  paymentMethod: z.enum(PAYMENT_METHOD_KEYS as [string, ...string[]]).nullable().optional(),
  paymentDate: dateSchema.nullable().optional(),
  ...discountFields,
  lines: z.array(z.object({
    productId: z.string().uuid('Selecciona un producto válido.'),
    quantity: z.number().positive().max(1_000_000),
    unitPrice: z.number().positive('El precio debe ser mayor a cero.').max(100_000_000).nullish(),
    priceNote: z.string().trim().max(1000).nullish(),
    observations: z.string().trim().max(5000).nullable().optional(),
    ...discountFields
  })).min(1, 'Agrega al menos un producto.').max(100)
})

function validateOrderDiscounts(
  data: { discountType: string, discountValue: number, lines: { discountType: string, discountValue: number }[] },
  ctx: z.RefinementCtx
) {
  validateDiscount(data, ctx)
  data.lines.forEach((line, index) => validateDiscount(line, ctx, ['lines', index]))
}

export const createOrderSchema = orderFieldsSchema.superRefine((data, ctx) => {
  validateOrderDiscounts(data, ctx)
  if (STATUS_KEYS_REQUIRING_REPARTIDOR.includes(data.statusKey) && !data.repartidorId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['repartidorId'],
      message: 'Selecciona un repartidor para confirmar el pedido.'
    })
  }
})

export const updateQuoteSchema = orderFieldsSchema.pick({
  customerId: true,
  orderDate: true,
  observations: true,
  tags: true,
  discountType: true,
  discountValue: true,
  lines: true
}).extend({
  version: z.number().int().positive()
}).superRefine(validateOrderDiscounts)

export const updateOrderStatusSchema = z.object({
  statusKey: z.string().trim().min(1).max(32),
  note: z.string().trim().max(1000).nullable().optional(),
  version: z.number().int().positive()
})

export const updateOrderRemisionSchema = z.object({
  remision: z.string().trim().max(100).nullable().optional(),
  version: z.number().int().positive()
})

export const updateOrderPaymentSchema = z.object({
  paymentStatus: z.enum(PAYMENT_STATUS_KEYS as [string, ...string[]]),
  paymentMethod: z.enum(PAYMENT_METHOD_KEYS as [string, ...string[]]).nullable().optional(),
  version: z.number().int().positive()
})

export const updateOrderRepartidorSchema = z.object({
  repartidorId: z.string().uuid('Selecciona un repartidor válido.'),
  version: z.number().int().positive()
})

export const updateOrderTagsSchema = z.object({
  tags: z.array(z.string().trim().min(1).max(50)).max(20),
  version: z.number().int().positive()
})

export const updateOrderItemPriceSchema = z.object({
  unitPrice: z.number().positive('El precio debe ser mayor a cero.').max(100_000_000),
  note: z.string().trim().max(1000).nullable().optional(),
  version: z.number().int().positive()
})

// IPv4 literal only: hostnames are rejected to avoid DNS rebinding on the
// server-side printer socket (see server/utils/ticket-printer.ts).
export const ticketPrintSchema = z.object({
  host: z.string().regex(/^\d{1,3}(?:\.\d{1,3}){3}$/, 'Usa la dirección IP de la impresora.'),
  port: z.number().int().min(1).max(65535),
  charsPerLine: z.number().int().min(24).max(64)
})

export type CreateOrderInput = z.output<typeof createOrderSchema>
export type UpdateQuoteInput = z.output<typeof updateQuoteSchema>
export type UpdateOrderStatusInput = z.output<typeof updateOrderStatusSchema>
export type UpdateOrderRemisionInput = z.output<typeof updateOrderRemisionSchema>
export type UpdateOrderPaymentInput = z.output<typeof updateOrderPaymentSchema>
export type UpdateOrderRepartidorInput = z.output<typeof updateOrderRepartidorSchema>
export type UpdateOrderTagsInput = z.output<typeof updateOrderTagsSchema>
export type UpdateOrderItemPriceInput = z.output<typeof updateOrderItemPriceSchema>
export type TicketPrintInput = z.output<typeof ticketPrintSchema>
