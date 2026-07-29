import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../supabase/migrations/20260728171332_backfill_completed_order_payments.sql', import.meta.url),
  'utf8'
)

describe('backfill de pagos históricos', () => {
  it('migra únicamente pedidos completamente pagados', () => {
    expect(migration).toContain('orders.payment_status = \'pago_recibido\'')
    expect(migration).not.toContain('orders.payment_status = \'abonado\'')
  })

  it('conserva el método, total, moneda y fecha disponibles en el pedido', () => {
    expect(migration).toContain('coalesce(orders.payment_method, \'otro\')')
    expect(migration).toContain('orders.total')
    expect(migration).toContain('orders.currency_code')
    expect(migration).toContain('coalesce(orders.payment_date, orders.order_date)')
  })

  it('es idempotente y no duplica pedidos que ya tienen pagos', () => {
    expect(migration).toContain('not exists')
    expect(migration).toContain('payments.order_id = orders.id')
  })
})
