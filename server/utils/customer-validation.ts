import * as z from 'zod'

// Expresiones del contrato de Siigo México para POST /v1/customers:
// Moral 12 caracteres (3+6+3), Physical 13 (4+6+3). Foreign no tiene regla publicada.
const RFC_MORAL_PATTERN = /^[A-ZÑ&]{3}\d{6}[A-ZÑ0-9]{3}$/
const RFC_PHYSICAL_PATTERN = /^[A-ZÑ&]{4}\d{6}[A-ZÑ0-9]{3}$/

const namePartSchema = z.string().trim().min(1, 'Escribe el nombre.').max(100)
const optionalShortText = z.string().trim().max(20).optional()

export const createCustomerSchema = z.object({
  personType: z.enum(['Physical', 'Moral', 'Foreign']),
  name: z.array(namePartSchema).min(1).max(2),
  rfcId: z.string().trim().toUpperCase().min(12, 'El RFC debe tener 12 o 13 caracteres.').max(13),
  fiscalRegime: z.string().trim().regex(/^\d{3}$/, 'Usa un código de régimen fiscal del SAT.').optional(),
  email: z.string().trim().toLowerCase().email('Escribe un correo válido.').max(100).optional(),
  phone: z.string().trim().regex(/^\d{7,10}$/, 'Usa solo dígitos (7 a 10).').optional(),
  comments: z.string().trim().max(4000).optional(),
  address: z.object({
    street: z.string().trim().min(1, 'Escribe la calle.').max(256),
    exteriorNumber: optionalShortText,
    interiorNumber: optionalShortText,
    colony: optionalShortText,
    postalCode: z.string().trim().regex(/^\d{5}$/, 'Usa un código postal de 5 dígitos.').optional(),
    city: z.object({
      countryCode: z.string().trim().min(1, 'Indica el código de país.').max(5),
      stateCode: z.string().trim().min(1, 'Indica el código de estado.').max(10),
      cityCode: z.string().trim().min(1, 'Indica el código de ciudad.').max(10)
    })
  })
}).superRefine((data, ctx) => {
  if (data.personType === 'Physical') {
    if (data.name.length !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: 'Una persona física necesita nombres y apellidos.'
      })
    }
    if (!RFC_PHYSICAL_PATTERN.test(data.rfcId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rfcId'],
        message: 'El RFC de persona física debe tener 13 caracteres (AAAA000000XXX).'
      })
    }
  }

  if (data.personType === 'Moral') {
    if (data.name.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: 'Una persona moral usa solo la razón social.'
      })
    }
    if (!RFC_MORAL_PATTERN.test(data.rfcId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rfcId'],
        message: 'El RFC de persona moral debe tener 12 caracteres (AAA000000XXX).'
      })
    }
  }

  if (data.personType === 'Foreign' && data.name.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['name'],
      message: 'Un cliente extranjero usa un solo campo de nombre.'
    })
  }
})

export type CreateCustomerInput = z.output<typeof createCustomerSchema>
