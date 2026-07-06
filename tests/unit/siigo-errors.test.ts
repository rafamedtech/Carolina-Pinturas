import { describe, expect, it } from 'vitest'
import { siigoErrorMessages } from '../../server/utils/siigo-errors'

describe('siigoErrorMessages', () => {
  it('extrae mensajes del formato { Errors: [{ Message }] }', () => {
    expect(siigoErrorMessages({
      Errors: [{ Code: 'invalid_rfc', Message: 'El RFC no es válido.' }]
    })).toBe('El RFC no es válido.')
  })

  it('extrae mensajes del formato en minúsculas { errors: [{ message }] }', () => {
    expect(siigoErrorMessages({
      errors: [{ code: 'already_exists', message: 'El cliente ya existe.' }]
    })).toBe('El cliente ya existe.')
  })

  it('une varios mensajes en uno solo', () => {
    expect(siigoErrorMessages({
      Errors: [
        { Message: 'El RFC no es válido.' },
        { Message: 'La ciudad no existe.' }
      ]
    })).toBe('El RFC no es válido. La ciudad no existe.')
  })

  it('devuelve null cuando no hay estructura de errores reconocible', () => {
    expect(siigoErrorMessages(null)).toBeNull()
    expect(siigoErrorMessages('error plano')).toBeNull()
    expect(siigoErrorMessages({})).toBeNull()
    expect(siigoErrorMessages({ Errors: 'no es arreglo' })).toBeNull()
    expect(siigoErrorMessages({ Errors: [{ Message: '   ' }, {}] })).toBeNull()
  })
})
