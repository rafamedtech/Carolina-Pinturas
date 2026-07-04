import { useLocalStorage } from '@vueuse/core'
import { TICKET_DEFAULT_CHARS, type TicketPaperWidth } from '#shared/types/ticket'

export type TicketPrintMethod = 'dialog' | 'network' | 'bluetooth'

export interface PrinterSettings {
  paperWidth: TicketPaperWidth
  method: TicketPrintMethod
  networkHost: string
  networkPort: number
  charsPerLine: number | null
}

const DEFAULT_SETTINGS: PrinterSettings = {
  paperWidth: 80,
  method: 'dialog',
  networkHost: '',
  networkPort: 9100,
  charsPerLine: null
}

// Per-device config: each caja/computadora remembers its own printer.
export function usePrinterSettings() {
  const settings = useLocalStorage<PrinterSettings>('cp:printer-settings', DEFAULT_SETTINGS, {
    mergeDefaults: true
  })

  const effectiveCharsPerLine = computed(() =>
    settings.value.charsPerLine ?? TICKET_DEFAULT_CHARS[settings.value.paperWidth] ?? 48)

  return { settings, effectiveCharsPerLine }
}
