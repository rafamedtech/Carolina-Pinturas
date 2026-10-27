import { describe, expect, it } from 'vitest'
import { orderHasPaymentStatus, orderPaymentStatusColor, orderPaymentStatusLabel } from '../../app/utils/orderPayment'

describe('estado de pago compartido entre tabla y detalle', () => {
  it.each([
    ['borrador', false],
    ['cancelado', false],
    ['ingresado', true],
    ['entregado', true]
  ] as const)('determina si corresponde mostrar estado de pago para %s', (status, expected) => {
    expect(orderHasPaymentStatus(status)).toBe(expected)
  })
  it.each([
    ['pendiente_pago', 'Pago pendiente', 'warning'],
    ['abonado', 'Abonado', 'info'],
    ['pago_recibido', 'Pago recibido', 'success']
  ])('muestra %s con el texto y color habituales hasta los siete días', (status, label, color) => {
    expect(orderPaymentStatusLabel(status)).toBe(label)
    expect(orderPaymentStatusColor(status, '2026-10-20', '2026-10-27')).toBe(color)
    expect(orderPaymentStatusColor(status, '2026-10-27', '2026-10-27')).toBe(color)
  })

  it.each(['pendiente_pago', 'abonado'])('marca %s en rojo al superar siete días, incluso entre meses', (status) => {
    expect(orderPaymentStatusColor(status, '2026-09-30', '2026-10-08')).toBe('error')
  })

  it('conserva el verde de un pedido pagado antiguo', () => {
    expect(orderPaymentStatusColor('pago_recibido', '2026-01-01', '2026-10-27')).toBe('success')
  })
})
