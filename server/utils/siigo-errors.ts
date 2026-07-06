// Siigo responde los errores como { Errors: [{ Code, Message, Params }] }
// (a veces en minúsculas); se extraen los mensajes para mostrarlos al usuario.
export function siigoErrorMessages(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null

  const container = data as { Errors?: unknown, errors?: unknown }
  const errors = container.Errors ?? container.errors

  if (!Array.isArray(errors)) return null

  const messages = errors
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const errorItem = item as { Message?: unknown, message?: unknown }
      const message = errorItem.Message ?? errorItem.message
      return typeof message === 'string' && message.trim() ? message.trim() : null
    })
    .filter((message): message is string => Boolean(message))

  return messages.length ? messages.join(' ') : null
}
