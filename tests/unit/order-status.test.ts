import { describe, expect, it } from 'vitest'
import { resolveCreatedOrderStatusKey } from '../../app/utils/orderCreation'

describe('resolveCreatedOrderStatusKey', () => {
  it('marks a new order as delivered when its repartidor is Mostrador', () => {
    expect(resolveCreatedOrderStatusKey('ingresado', true)).toBe('entregado')
    expect(resolveCreatedOrderStatusKey('confirmado', true)).toBe('entregado')
  })

  it('keeps quotations assigned to Mostrador as drafts', () => {
    expect(resolveCreatedOrderStatusKey('borrador', true)).toBe('borrador')
  })

  it('keeps the requested status for other repartidores', () => {
    expect(resolveCreatedOrderStatusKey('ingresado', false)).toBe('ingresado')
  })
})
