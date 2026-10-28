// Siigo responde los errores como { Errors: [{ Code, Message, Params }] }
// (a veces en minúsculas); se extraen los mensajes para mostrarlos al usuario.
export function siigoErrorDetails(data: unknown) {
  if (!data || typeof data !== 'object') return []

  const container = data as { Errors?: unknown, errors?: unknown }
  const errors = container.Errors ?? container.errors

  if (!Array.isArray(errors)) return []

  const text = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, 1000) : ''
  return errors.slice(0, 20).flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const entry = item as Record<string, unknown>
    // Conservar solo los campos del contrato de errores; nunca headers, tokens o el request completo.
    const code = text(entry.Code ?? entry.code)
    const message = text(entry.Message ?? entry.message)
    const detail = text(entry.Detail ?? entry.detail)
    const params = entry.Params ?? entry.params
    if (!code && !message && !detail) return []
    return [{
      code, message, detail,
      params: Array.isArray(params) ? params.slice(0, 20).map(text).filter(Boolean) : []
    }]
  })
}

export function siigoErrorMessages(data: unknown, includeDetails = false): string | null {
  const messages = siigoErrorDetails(data)
    .map((error) => {
      const message = error.code === 'product_service'
        ? 'Siigo no pudo procesar el producto. Revisa sus datos y configuración antes de volver a intentar.'
        : error.message
      if (!includeDetails) return message
      return [
        error.code ? `[${error.code}]` : '',
        error.code === 'documents_service'
          ? 'El servicio de documentos de Siigo no pudo procesar la solicitud. Verifica en Siigo si se creó el documento antes de volver a intentar.'
          : message,
        error.params.length ? `Campos: ${error.params.join(', ')}.` : '',
        error.detail && error.detail !== error.message ? error.detail : ''
      ].filter(Boolean).join(' ')
    })
    .filter(Boolean)

  return messages.length ? messages.join(' ') : null
}
