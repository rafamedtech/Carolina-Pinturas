import * as z from 'zod'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa una fecha con formato AAAA-MM-DD.')

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
  lines: z.array(z.object({
    productId: z.string().uuid('Selecciona un producto válido.'),
    quantity: z.number().positive().max(1_000_000),
    observations: z.string().trim().max(5000).nullable().optional()
  })).min(1, 'Agrega al menos un producto.').max(100)
})

export const createOrderSchema = orderFieldsSchema.superRefine((data, ctx) => {
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
  lines: true
}).extend({
  version: z.number().int().positive()
})

export const updateOrderStatusSchema = z.object({
  statusKey: z.string().trim().min(1).max(32),
  note: z.string().trim().max(1000).nullable().optional(),
  version: z.number().int().positive()
})

export const updateOrderRemisionSchema = z.object({
  remision: z.string().trim().max(100).nullable().optional(),
  version: z.number().int().positive()
})

export const updateOrderRepartidorSchema = z.object({
  repartidorId: z.string().uuid('Selecciona un repartidor válido.'),
  version: z.number().int().positive()
})

export type CreateOrderInput = z.output<typeof createOrderSchema>
export type UpdateQuoteInput = z.output<typeof updateQuoteSchema>
export type UpdateOrderStatusInput = z.output<typeof updateOrderStatusSchema>
export type UpdateOrderRemisionInput = z.output<typeof updateOrderRemisionSchema>
export type UpdateOrderRepartidorInput = z.output<typeof updateOrderRepartidorSchema>
