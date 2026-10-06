import * as z from 'zod'
import { purchaseDate } from './purchase'

// Decimal strings keep all six decimal places intact across JSON boundaries.
export const inventoryQuantity = z.string().regex(/^\d{1,14}(\.\d{1,6})?$/, 'Usa una cantidad positiva con hasta 6 decimales.')
export const inventoryPositive = inventoryQuantity.refine(s => /[1-9]/.test(s), 'La cantidad debe ser mayor a cero.')
const reason = z.string().trim().min(3).max(2000)
export const inventoryCost = inventoryPositive.refine(s => Number(s) <= 999_999_999, 'El costo no puede superar 999999999.')
const costFields = { unitCost: inventoryCost.optional(), costCurrency: z.enum(['MXN', 'USD']).optional() }
const line = z.object({ productId: z.uuid(), quantity: inventoryPositive, ...costFields })
const lines = z.array(line).min(1).max(100).refine(v => new Set(v.map(i => i.productId)).size === v.length, 'No repitas productos.')
export const inventoryTypes = ['inicial', 'entrada', 'salida', 'traspaso', 'devolucion_cliente', 'devolucion_proveedor', 'ajuste', 'surtido', 'recepcion', 'reversion'] as const
export const inventoryQuery = z.object({
  page: z.coerce.number().int().min(1).default(1), page_size: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(200).default(''), warehouseId: z.uuid().optional(), productId: z.uuid().optional(),
  from: purchaseDate.optional(), to: purchaseDate.optional(), type: z.enum(inventoryTypes).optional(), low: z.enum(['true', 'false']).optional(), controlledOnly: z.enum(['true', 'false']).optional()
})
export const inventoryCommand = z.object({
  requestId: z.uuid(),
  command: z.discriminatedUnion('action', [
    z.object({ action: z.literal('warehouse'), id: z.uuid().optional(), version: z.number().int().positive().optional(), code: z.string().trim().min(1).max(64), name: z.string().trim().min(1).max(200), address: z.string().trim().max(1000).default(''), active: z.boolean().default(true) }),
    z.object({ action: z.literal('tracking'), productId: z.uuid(), enabled: z.boolean(), version: z.number().int().positive() }),
    z.object({ action: z.literal('minimum'), warehouseId: z.uuid(), productId: z.uuid(), minimum: inventoryQuantity, version: z.number().int().positive() }),
    z.object({ action: z.literal('activate'), version: z.number().int().positive() }),
    z.object({ action: z.literal('move'), type: z.enum(['inicial', 'entrada', 'salida', 'traspaso']), warehouseId: z.uuid(), destinationId: z.uuid().optional(), date: purchaseDate, reason, lines }),
    z.object({ action: z.literal('return'), sourceMovementId: z.uuid(), warehouseId: z.uuid(), date: purchaseDate, reason, lines }),
    z.object({ action: z.literal('reverse'), movementId: z.uuid(), date: purchaseDate, reason }),
    z.object({ action: z.literal('countCreate'), warehouseId: z.uuid(), date: purchaseDate, reason }),
    z.object({ action: z.literal('countAdd'), id: z.uuid(), version: z.number().int().positive(), productId: z.uuid() }),
    z.object({ action: z.literal('countRemove'), id: z.uuid(), version: z.number().int().positive(), productId: z.uuid() }),
    z.object({ action: z.literal('countEdit'), id: z.uuid(), version: z.number().int().positive(), lines: z.array(z.object({ productId: z.uuid(), counted: inventoryQuantity, ...costFields })).min(1) }),
    z.object({ action: z.literal('countRefresh'), id: z.uuid(), version: z.number().int().positive() }),
    z.object({ action: z.literal('countSubmit'), id: z.uuid(), version: z.number().int().positive() }),
    z.object({ action: z.literal('countApply'), id: z.uuid(), version: z.number().int().positive() }),
    z.object({ action: z.literal('countCancel'), id: z.uuid(), version: z.number().int().positive() })
  ])
}).superRefine((input, ctx) => {
  const c = input.command
  if (c.action === 'move' && c.type === 'inicial') c.lines.forEach((line, index) => {
    for (const key of ['unitCost', 'costCurrency'] as const) if (line[key] === undefined) ctx.addIssue({ code: 'custom', path: ['command', 'lines', index, key], message: 'Captura el costo unitario y su moneda.' })
  })
})
export type InventoryCommand = z.infer<typeof inventoryCommand>
export type InventoryQuery = z.infer<typeof inventoryQuery>
