import type { H3Event } from 'h3'

interface AccessToken {
  value: string
  expiresAt: number
}

let token: AccessToken | null = null
const SIIGO_REQUEST_TIMEOUT_MS = 15_000

export function siigoConfigured() {
  const { siigo } = useRuntimeConfig()
  return Boolean(siigo.apiUrl && siigo.username && siigo.accessKey && siigo.applicationId)
}

function getConfig() {
  const { siigo } = useRuntimeConfig()

  if (!siigoConfigured()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'La conexión con Siigo no está configurada todavía.'
    })
  }

  return {
    apiUrl: siigo.apiUrl.replace(/\/$/, ''),
    username: siigo.username,
    accessKey: siigo.accessKey,
    applicationId: siigo.applicationId
  }
}

async function getAccessToken() {
  if (token && token.expiresAt > Date.now()) return token.value

  const config = getConfig()

  try {
    const response = await $fetch<{ access_token?: string }>(`${config.apiUrl}/auth`, {
      method: 'POST',
      timeout: SIIGO_REQUEST_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'SiigoAPI-Application-Id': config.applicationId
      },
      body: {
        username: config.username,
        access_key: config.accessKey
      }
    })

    if (!response.access_token) {
      throw new Error('La respuesta no incluyó access_token.')
    }

    // Siigo indica una vigencia de 24 horas. Se renueva antes para evitar fallos en límite.
    token = {
      value: response.access_token,
      expiresAt: Date.now() + (23 * 60 * 60 * 1000)
    }

    return token.value
  } catch (error) {
    token = null
    throw createError({
      statusCode: 502,
      statusMessage: 'No se pudo autenticar con Siigo. Verifica la configuración regional y las credenciales.',
      data: error instanceof Error ? error.message : undefined
    })
  }
}

export async function siigoRequest<T>(path: string, options: { query?: Record<string, string | undefined> } = {}): Promise<T> {
  const config = getConfig()
  const accessToken = await getAccessToken()

  try {
    return await $fetch<unknown>(`${config.apiUrl}${path}`, {
      timeout: SIIGO_REQUEST_TIMEOUT_MS,
      headers: {
        'Authorization': accessToken,
        'SiigoAPI-Application-Id': config.applicationId
      },
      query: options.query
    }) as T
  } catch (error: unknown) {
    const fetchError = error as {
      response?: { status?: number }
      data?: unknown
      message?: string
    }
    const status = fetchError.response?.status

    if (status === 401) token = null

    const timedOut = error instanceof Error && /timeout/i.test(`${error.name} ${error.message}`)

    throw createError({
      statusCode: timedOut ? 504 : status && status >= 400 && status < 500 ? status : 502,
      statusMessage: timedOut
        ? 'Siigo tardó demasiado en responder. Intenta actualizar de nuevo.'
        : 'Siigo no pudo completar la consulta.',
      data: fetchError.data || fetchError.message
    })
  }
}

export function listQuery(event: H3Event) {
  const query = getQuery(event)
  const page = typeof query.page === 'string' ? query.page : '1'
  const pageSize = typeof query.page_size === 'string' ? query.page_size : '25'

  return {
    page,
    page_size: pageSize,
    created_start: typeof query.created_start === 'string' ? query.created_start : undefined,
    created_end: typeof query.created_end === 'string' ? query.created_end : undefined
  }
}
