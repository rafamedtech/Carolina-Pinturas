import { describe, expect, it } from 'vitest'
import { siigoErrorDetails, siigoErrorMessages } from '../../server/utils/siigo-errors'

describe('siigoErrorMessages', () => {
  it('identifica documents_service aunque Siigo lo presente como un error genérico de datos', () => {
    const data = { Errors: [{ Code: 'documents_service', Message: 'Your request could not be completed with the data you submitted. Please verify' }] }
    expect(siigoErrorMessages(data, true)).toContain('[documents_service] El servicio de documentos de Siigo')
    expect(siigoErrorMessages(data, true)).toContain('Verifica en Siigo si se creó el documento')
    expect(siigoErrorDetails(data)[0]?.message).toContain('Your request')
  })

  it('conserva código, campos y detalle detrás del mensaje genérico sin copiar secretos', () => {
    const data = {
      Authorization: 'secret-token',
      Errors: [{
        Code: 'entry_service',
        Message: 'Your request could not be completed with the data you submitted. Please verify',
        Params: ['items'], Detail: 'Detalle del rechazo de Siigo', access_key: 'secret-key'
      }]
    }
    expect(siigoErrorDetails(data)).toEqual([{
      code: 'entry_service', message: data.Errors[0]!.Message,
      params: ['items'], detail: 'Detalle del rechazo de Siigo'
    }])
    expect(siigoErrorMessages(data, true)).toBe(`[entry_service] ${data.Errors[0]!.Message} Campos: items. Detalle del rechazo de Siigo`)
    expect(JSON.stringify(siigoErrorDetails(data))).not.toContain('secret')
  })

  it('normaliza detalles en minúsculas e ignora valores anidados inesperados', () => {
    expect(siigoErrorDetails({ errors: [{ code: 'invalid_value', detail: 'Revisa la cuota', params: ['quote', { access_key: 'secret' }] }] }))
      .toEqual([{ code: 'invalid_value', message: '', detail: 'Revisa la cuota', params: ['quote'] }])
    expect(siigoErrorMessages({ errors: [{ code: 'invalid_value' }] }, true)).toBe('[invalid_value]')
  })

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
