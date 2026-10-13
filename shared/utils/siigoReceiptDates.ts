import { parseDate } from '@internationalized/date'
import { formatDate, mexicoToday } from './datetime'

/** La fecha real del pago nunca se sustituye por la del timbrado. */
export function siigoReceiptPaymentDateError(paymentDate: string, today = mexicoToday()): string | null {
  let date
  try {
    date = parseDate(paymentDate)
  } catch {
    return 'La fecha en que recibiste el pago no es válida.'
  }
  const current = parseDate(today)
  if (date.compare(current) > 0) {
    return 'La fecha en que recibiste el pago no puede ser posterior a hoy.'
  }
  // Siigo México publica una ventana de tres días anteriores para documentos
  // electrónicos y el tenant rechazó 2026-10-02 el 2026-10-13 (invalid_date).
  // Su contrato de vouchers sólo expone date: no inventar un campo FechaPago ni
  // emitir con otra fecha real en su lugar. Los históricos requieren Siigo Nube
  // o un contrato confirmado que permita separar las dos fechas del CFDI.
  if (date.compare(current.subtract({ days: 3 })) < 0) {
    return `El pago se recibió el ${formatDate(paymentDate)}. La API de Siigo rechaza esa fecha para timbrar y no documenta una fecha de emisión independiente. Revisa la recepción en Siigo Nube conservando la fecha real del pago.`
  }
  return null
}
