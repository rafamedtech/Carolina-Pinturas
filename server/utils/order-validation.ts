import * as z from 'zod'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa una fecha con formato AAAA-MM-DD.')

export const createOrderSchema = z.object({
  customerId: z.string().uuid('Selecciona un cliente válido.'),
  repartidorId: z.string().uuid('Selecciona un repartidor válido.'),
  statusKey: z.string().trim().min(1).max(32).default('ingresado'),
  orderDate: dateSchema,
  promisedDate: dateSchema.nullable().optional(),
  observations: z.string().trim().max(5000).nullable().optional(),
  remision: z.string().trim().max(100).nullable().optional(),
  lines: z.array(z.object({
    productId: z.string().uuid('Selecciona un producto válido.'),
    quantity: z.number().positive().max(1_000_000)
  })).min(1, 'Agrega al menos un producto.').max(100)
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

export type CreateOrderInput = z.output<typeof createOrderSchema>
export type UpdateOrderStatusInput = z.output<typeof updateOrderStatusSchema>
export type UpdateOrderRemisionInput = z.output<typeof updateOrderRemisionSchema>
