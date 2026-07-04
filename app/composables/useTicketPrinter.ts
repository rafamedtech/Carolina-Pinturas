import type { SalesOrderDetail } from '~/types/orders'
import { buildTicketBytes } from '#shared/utils/ticketEscpos'

export function useTicketPrinter() {
  const toast = useToast()
  const { settings, effectiveCharsPerLine } = usePrinterSettings()
  const bluetooth = useBluetoothPrinter()
  const printingTicket = ref(false)

  function openTicketPreview(orderId: string) {
    window.open(`/ventas/${orderId}/ticket?width=${settings.value.paperWidth}`, '_blank', 'noopener')
  }

  function printViaDialog(orderId: string) {
    window.open(
      `/ventas/${orderId}/ticket?width=${settings.value.paperWidth}&action=print`,
      '_blank',
      'noopener'
    )
  }

  async function printViaNetwork(orderId: string) {
    if (!settings.value.networkHost) {
      toast.add({
        title: 'Configura la impresora de red',
        description: 'Captura la dirección IP de la impresora en la configuración de tickets.',
        color: 'warning'
      })
      return
    }

    await $fetch(`/api/orders/${encodeURIComponent(orderId)}/ticket-print`, {
      method: 'POST',
      body: {
        host: settings.value.networkHost,
        port: settings.value.networkPort,
        charsPerLine: effectiveCharsPerLine.value
      }
    })
    toast.add({ title: 'Ticket enviado a la impresora', color: 'success' })
  }

  async function printViaBluetooth(order: SalesOrderDetail) {
    const bytes = buildTicketBytes(order, { charsPerLine: effectiveCharsPerLine.value })
    await bluetooth.print(bytes)
    toast.add({ title: 'Ticket enviado a la impresora', color: 'success' })
  }

  async function printTicket(order: SalesOrderDetail) {
    if (printingTicket.value) return

    printingTicket.value = true
    try {
      if (settings.value.method === 'network') {
        await printViaNetwork(order.id)
      } else if (settings.value.method === 'bluetooth') {
        await printViaBluetooth(order)
      } else {
        printViaDialog(order.id)
      }
    } catch (printError) {
      // User closed the Bluetooth device chooser: not an error.
      if (printError instanceof DOMException && printError.name === 'NotFoundError') return

      const statusMessage = (printError as { data?: { statusMessage?: string } }).data?.statusMessage
      toast.add({
        title: 'No fue posible imprimir el ticket',
        description: statusMessage || (printError instanceof Error ? printError.message : undefined),
        color: 'error'
      })
    } finally {
      printingTicket.value = false
    }
  }

  return { printTicket, openTicketPreview, printingTicket: readonly(printingTicket) }
}
