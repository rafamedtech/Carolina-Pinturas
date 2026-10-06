import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { inventoryCommand } from '../../shared/schemas/inventory'

const move = { action: 'move' as const, type: 'inicial' as const, warehouseId: randomUUID(), date: '2026-10-06', reason: 'Carga inicial', lines: [{ productId: randomUUID(), quantity: '1', unitCost: '12.123456', costCurrency: 'MXN' }] }
const valid = (command: unknown) => inventoryCommand.safeParse({ requestId: randomUUID(), command }).success

describe('costos de inventario inicial', () => {
  it('exige costo y moneda y conserva seis decimales', () => {
    expect(valid(move)).toBe(true)
    expect(valid({ ...move, lines: [{ productId: move.lines[0]!.productId, quantity: '1' }] })).toBe(false)
    for (const unitCost of ['0', '-1', '12.1234567', '1000000000', 'NaN']) expect(valid({ ...move, lines: [{ ...move.lines[0], unitCost }] })).toBe(false)
    expect(valid({ ...move, lines: [{ ...move.lines[0], costCurrency: 'EUR' }] })).toBe(false)
  })
  it('las entradas posteriores no requieren costo ni alteran el costo de compra', () => {
    expect(valid({ ...move, type: 'entrada', lines: [{ productId: move.lines[0]!.productId, quantity: '1' }] })).toBe(true)
  })
})
