import type { UserRole } from '~/types/siigo'
import type { PurchaseView } from '~/types/purchases'
import { canViewPurchaseFinancials } from '~/utils/roleAccess'

const OPERATIONAL_PURCHASE_EVENTS = new Set(['create', 'edit', 'confirm', 'cancel', 'receive', 'voidReceipt'])

/**
 * Vista de compra según el rol. Mostrador recibe mercancía sin ver costos,
 * facturas, saldos ni abonos (mismo criterio que oculta los gastos de compra).
 */
export function purchaseViewForRole(view: PurchaseView, role: UserRole): PurchaseView {
  if (canViewPurchaseFinancials(role)) return view
  return {
    ...view,
    status: view.status === 'liquidada' || view.status === 'vencida' ? 'confirmada' : view.status,
    subtotal: 0,
    vatAmount: 0,
    total: 0,
    balance: 0,
    invoiced: 0,
    items: view.items.map(item => ({ ...item, unitCost: 0, total: 0 })),
    invoices: [],
    events: view.events
      .filter(event => OPERATIONAL_PURCHASE_EVENTS.has(event.action))
      .map(event => ({ ...event, detail: event.detail && typeof event.detail === 'object' && 'reason' in event.detail ? { reason: String(event.detail.reason) } : null })),
    financialsHidden: true
  }
}

const COST_KEYS = new Set(['unitCost', 'costCurrency', 'initialUnitCost', 'initialCostCurrency'])

function withoutCosts(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutCosts)
  if (!value || typeof value !== 'object' || value instanceof Date) return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => !COST_KEYS.has(key)).map(([key, item]) => [key, withoutCosts(item)]))
}

/**
 * Inventario según el rol. El costo unitario sale del último costo de compra,
 * así que se oculta con el mismo criterio que los importes de compras.
 */
export function inventoryForRole<T>(data: T, role: UserRole): T {
  return canViewPurchaseFinancials(role) ? data : withoutCosts(data) as T
}
