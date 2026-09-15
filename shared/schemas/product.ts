import * as z from 'zod'

const money = z.number().finite().positive('El precio debe ser positivo.').refine(
  value => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001,
  'Usa máximo dos decimales.'
)
export const productInputSchema = z.object({
  code: z.string().trim().min(1, 'Escribe el código.').max(30).regex(/^[A-Za-z0-9_-]+$/, 'Usa un código sin espacios.'),
  name: z.string().trim().min(1, 'Escribe el nombre.').max(100),
  account_group: z.number().int().positive('Selecciona una clasificación.'),
  type: z.enum(['Product', 'Service', 'ConsumerGood']),
  active: z.boolean(),
  stock_control: z.boolean(),
  tax_included: z.boolean(),
  unit: z.string().trim().min(1, 'Selecciona una unidad SAT.').max(10),
  key: z.string().regex(/^\d{8}$/, 'Selecciona una clave SAT de ocho dígitos.'),
  reference: z.string().trim().max(80),
  description: z.string().trim().max(2500),
  additional_fields: z.object({ barcode: z.string().trim().max(50), brand: z.string().trim().max(50) }),
  taxes: z.array(z.object({ id: z.number().int().positive() })).refine(
    items => new Set(items.map(item => item.id)).size === items.length, 'Hay impuestos repetidos.'
  ),
  prices: z.array(z.object({
    currency_code: z.string().regex(/^[A-Z]{3}$/, 'Usa una moneda de tres letras, como MXN.'),
    price_list: z.array(z.object({ position: z.number().int().min(1).max(12), value: money })).min(1).max(12)
  })).max(12)
}).superRefine((input, ctx) => {
  const keys = input.prices.flatMap(group => group.price_list.map(price => `${group.currency_code}:${price.position}`))
  if (new Set(keys).size !== keys.length || new Set(input.prices.map(p => p.currency_code)).size !== input.prices.length) {
    ctx.addIssue({ code: 'custom', path: ['prices'], message: 'No repitas moneda ni posición dentro de una moneda.' })
  }
})
export type ProductInput = z.infer<typeof productInputSchema>

const date = z.iso.date().optional()
export const productQuerySchema = z.object({
  all: z.enum(['true', 'false']).optional(),
  refresh: z.enum(['true', 'false']).optional(),
  active: z.enum(['true', 'false', 'all']).default('true'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
  code: z.string().trim().max(30).optional(),
  ids: z.string().transform(value => value.split(',')).pipe(z.array(z.uuid()).min(1).max(20)).optional(),
  created_start: date, created_end: date, updated_start: date, updated_end: date
}).superRefine((input, ctx) => {
  for (const prefix of ['created', 'updated'] as const) {
    const start = input[`${prefix}_start`]
    const end = input[`${prefix}_end`]
    if (start && end && start > end) ctx.addIssue({ code: 'custom', path: [`${prefix}_end`], message: 'La fecha final debe ser posterior o igual a la inicial.' })
  }
})
export type ProductQuery = z.infer<typeof productQuerySchema>
