import { describe, expect, it } from 'vitest'
import { siigoReceiptPaymentDateError } from '../../shared/utils/siigoReceiptDates'

describe('fecha real de recepción del pago', () => {
  it('distingue un pago histórico del día en que se solicita timbrar', () => {
    expect(siigoReceiptPaymentDateError('2026-10-02', '2026-10-13')).toContain('02/10/2026')
    expect(siigoReceiptPaymentDateError('2026-10-13', '2026-10-13')).toBeNull()
    expect(siigoReceiptPaymentDateError('2026-10-10', '2026-10-13')).toBeNull()
    expect(siigoReceiptPaymentDateError('2026-10-09', '2026-10-13')).not.toBeNull()
  })
  it('calcula días calendario correctamente al cruzar mes, año y febrero bisiesto', () => {
    expect(siigoReceiptPaymentDateError('2025-12-29', '2026-01-01')).toBeNull()
    expect(siigoReceiptPaymentDateError('2025-12-28', '2026-01-01')).not.toBeNull()
    expect(siigoReceiptPaymentDateError('2028-02-29', '2028-03-02')).toBeNull()
  })
  it('rechaza fechas futuras e inexistentes sin normalizarlas a otro día', () => {
    expect(siigoReceiptPaymentDateError('2026-10-14', '2026-10-13')).toContain('posterior')
    expect(siigoReceiptPaymentDateError('2026-02-29', '2026-10-13')).toContain('no es válida')
  })
})
