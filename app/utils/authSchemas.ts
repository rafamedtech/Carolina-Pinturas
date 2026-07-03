import * as z from 'zod'

const email = z.email('Escribe un correo válido.')
const password = z.string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña no puede exceder 72 caracteres.')

export const loginSchema = z.strictObject({
  email,
  password
})

export const passwordRecoverySchema = z.strictObject({
  email
})

export const updatePasswordSchema = z.strictObject({
  password,
  confirmPassword: password
}).refine(data => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden.',
  path: ['confirmPassword']
})

export type LoginInput = z.output<typeof loginSchema>
export type PasswordRecoveryInput = z.output<typeof passwordRecoverySchema>
export type UpdatePasswordInput = z.output<typeof updatePasswordSchema>
