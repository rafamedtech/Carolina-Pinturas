import { Socket } from 'node:net'

const ALLOWED_PORTS = [9100, 9101, 9102, 9103]

// Only private-network IPv4 literals: the route would otherwise let any
// authenticated user make the server open TCP connections to arbitrary hosts.
// 127.0.0.1 is allowed so a fake printer (nc -l 9100) works in development.
export function isAllowedPrinterAddress(host: string, port: number) {
  if (!ALLOWED_PORTS.includes(port)) return false

  const octets = host.split('.').map(Number)
  if (octets.length !== 4 || octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false
  }

  const [a, b] = octets as [number, number, number, number]
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return host === '127.0.0.1'
}

export function sendToNetworkPrinter(host: string, port: number, bytes: Uint8Array) {
  return new Promise<void>((resolve, reject) => {
    const socket = new Socket()
    let settled = false

    const fail = (message: string) => {
      if (settled) return
      settled = true
      socket.destroy()
      reject(createError({ statusCode: 502, statusMessage: message }))
    }

    socket.setTimeout(5000, () => fail('La impresora no respondió a tiempo.'))
    socket.on('error', (socketError: NodeJS.ErrnoException) => {
      fail(socketError.code === 'ECONNREFUSED'
        ? 'La impresora rechazó la conexión. Verifica la IP y el puerto.'
        : 'No fue posible conectar con la impresora.')
    })
    socket.on('close', (hadError) => {
      if (settled || hadError) return
      settled = true
      resolve()
    })

    socket.connect(port, host, () => {
      socket.end(bytes)
    })
  })
}
