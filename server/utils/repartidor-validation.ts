import * as z from 'zod'

export const createRepartidorSchema = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre del repartidor.').max(150),
  telefono: z.string().trim().max(30).nullable().optional()
})

export type CreateRepartidorInput = z.output<typeof createRepartidorSchema>
