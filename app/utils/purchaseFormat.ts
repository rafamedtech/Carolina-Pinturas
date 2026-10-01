type BadgeColor = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info'

const PURCHASE_STATUS: Record<string, { label: string, color: BadgeColor, icon: string }> = {
  borrador: { label: 'Borrador', color: 'neutral', icon: 'i-lucide-file-pen' },
  confirmada: { label: 'Confirmada', color: 'primary', icon: 'i-lucide-circle-check' },
  cancelada: { label: 'Cancelada', color: 'error', icon: 'i-lucide-circle-x' }
}
const RECEIPT_STATUS: Record<string, { label: string, color: BadgeColor, icon: string }> = {
  pendiente: { label: 'Sin recibir', color: 'neutral', icon: 'i-lucide-package' },
  parcial: { label: 'Recepción parcial', color: 'warning', icon: 'i-lucide-package-open' },
  completa: { label: 'Recibida', color: 'success', icon: 'i-lucide-package-check' }
}
const INVOICE_STATUS: Record<string, { label: string, color: BadgeColor }> = {
  pendiente: { label: 'Pendiente', color: 'warning' },
  vencida: { label: 'Vencida', color: 'error' },
  liquidada: { label: 'Liquidada', color: 'success' },
  anulada: { label: 'Anulada', color: 'neutral' }
}

export const purchaseStatus = (key: string) => PURCHASE_STATUS[key] ?? { label: key, color: 'neutral' as const, icon: 'i-lucide-circle' }
export const receiptStatus = (key: string) => RECEIPT_STATUS[key] ?? { label: key, color: 'neutral' as const, icon: 'i-lucide-package' }
export const invoiceStatus = (key: string) => INVOICE_STATUS[key] ?? { label: key, color: 'neutral' as const }

export function purchaseMoney(value: number, currency: string) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

export function purchaseQuantity(value: number) {
  return value.toLocaleString('es-MX', { maximumFractionDigits: 6 })
}

// Fechas de negocio (YYYY-MM-DD) sin zona horaria: formatear en UTC evita corrimientos de día.
export function purchaseDateLabel(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}
