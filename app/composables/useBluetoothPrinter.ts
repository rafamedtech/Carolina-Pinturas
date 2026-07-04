/// <reference types="web-bluetooth" />
// Web Bluetooth (BLE) path for thermal printers. Chrome-only and HTTPS-only;
// classic Bluetooth (SPP) printers are not reachable from the browser.
// Service families covered: 0x18F0 (common Chinese thermal), ISSC/Microchip
// transparent UART, and the 0xFF00 vendor family.
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb'
]

const CHUNK_SIZE = 120
const CHUNK_DELAY_MS = 30

// Module scope, not useState: GATT objects are not serializable and must
// survive across component instances for reprints without re-pairing.
const device = shallowRef<BluetoothDevice | null>(null)
const characteristic = shallowRef<BluetoothRemoteGATTCharacteristic | null>(null)
const deviceName = ref<string | null>(null)
const printing = ref(false)

function onDisconnected() {
  characteristic.value = null
}

async function findWritableCharacteristic(server: BluetoothRemoteGATTServer) {
  const services = await server.getPrimaryServices()
  for (const service of services) {
    const characteristics = await service.getCharacteristics()
    const writable = characteristics.find(entry =>
      entry.properties.writeWithoutResponse || entry.properties.write)
    if (writable) return writable
  }
  return null
}

async function connect() {
  if (characteristic.value?.service.device.gatt?.connected) return characteristic.value

  let target = device.value
  if (target?.gatt && !target.gatt.connected) {
    try {
      await target.gatt.connect()
    } catch {
      target = null
    }
  }

  if (!target?.gatt?.connected) {
    target = await navigator.bluetooth.requestDevice({
      filters: PRINTER_SERVICES.map(service => ({ services: [service] })),
      optionalServices: PRINTER_SERVICES
    })
    target.addEventListener('gattserverdisconnected', onDisconnected)
    await target.gatt?.connect()
  }

  if (!target.gatt?.connected) {
    throw new Error('No fue posible conectar con la impresora Bluetooth.')
  }

  const writable = await findWritableCharacteristic(target.gatt)
  if (!writable) {
    target.gatt.disconnect()
    throw new Error('La impresora Bluetooth no expone un canal de escritura compatible.')
  }

  device.value = target
  deviceName.value = target.name || 'Impresora Bluetooth'
  characteristic.value = writable
  return writable
}

export function useBluetoothPrinter() {
  const isSupported = computed(() =>
    import.meta.client && window.isSecureContext && 'bluetooth' in navigator)

  async function print(bytes: Uint8Array) {
    if (!isSupported.value) {
      throw new Error('Este navegador no soporta impresión por Bluetooth.')
    }
    if (printing.value) return

    printing.value = true
    try {
      const writable = await connect()
      for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
        const chunk = bytes.slice(offset, offset + CHUNK_SIZE)
        if (writable.properties.writeWithoutResponse) {
          await writable.writeValueWithoutResponse(chunk)
        } else {
          await writable.writeValueWithResponse(chunk)
        }
        await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY_MS))
      }
    } catch (printError) {
      characteristic.value = null
      throw printError
    } finally {
      printing.value = false
    }
  }

  // Pair from the settings modal without printing anything.
  async function pair() {
    if (!isSupported.value) {
      throw new Error('Este navegador no soporta impresión por Bluetooth.')
    }
    await connect()
  }

  function forget() {
    if (device.value) {
      device.value.removeEventListener('gattserverdisconnected', onDisconnected)
      device.value.gatt?.disconnect()
    }
    device.value = null
    characteristic.value = null
    deviceName.value = null
  }

  return {
    isSupported,
    deviceName: readonly(deviceName),
    printing: readonly(printing),
    print,
    pair,
    forget
  }
}
