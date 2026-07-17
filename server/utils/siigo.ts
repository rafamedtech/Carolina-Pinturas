import type { H3Event } from 'h3'
import { siigoErrorMessages } from './siigo-errors'

interface AccessToken {
  value: string
  expiresAt: number
}

let token: AccessToken | null = null
let tokenRequest: Promise<string> | null = null
const SIIGO_REQUEST_TIMEOUT_MS = 15_000
const SIIGO_READ_RETRIES = 2
const SIIGO_MAX_RETRY_DELAY_MS = 10_000

function wait(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function retryDelay(error: unknown, attempt: number) {
  const retryAfter = (error as { response?: { headers?: { get?: (name: string) => string | null } } })
    ?.response?.headers?.get?.('retry-after')

  if (retryAfter) {
    const seconds = Number(retryAfter)
    const milliseconds = Number.isFinite(seconds)
      ? seconds * 1000
      : Date.parse(retryAfter) - Date.now()

    if (Number.isFinite(milliseconds) && milliseconds > 0) {
      return Math.min(milliseconds, SIIGO_MAX_RETRY_DELAY_MS)
    }
  }

  return 750 * (2 ** attempt)
}

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
  if (tokenRequest) return tokenRequest

  tokenRequest = requestAccessToken()

  try {
    return await tokenRequest
  } finally {
    tokenRequest = null
  }
}

async function requestAccessToken() {
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

export async function siigoRequest<T>(path: string, options: {
  method?: 'GET' | 'POST' | 'PUT'
  body?: object
  query?: Record<string, string | undefined>
} = {}): Promise<T> {
  const config = getConfig()
  const accessToken = await getAccessToken()
  const method = options.method || 'GET'
  const maxAttempts = method === 'GET' ? SIIGO_READ_RETRIES + 1 : 1

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await $fetch<unknown>(`${config.apiUrl}${path}`, {
        method,
        retry: 0,
        timeout: SIIGO_REQUEST_TIMEOUT_MS,
        headers: {
          'Authorization': accessToken,
          'SiigoAPI-Application-Id': config.applicationId
        },
        body: options.body,
        query: options.query
      }) as T
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status

      if (status === 429 && attempt < maxAttempts - 1) {
        await wait(retryDelay(error, attempt))
        continue
      }

      throw normalizeSiigoError(error)
    }
  }

  throw createError({ statusCode: 502, statusMessage: 'Siigo no pudo completar la consulta.' })
}

function normalizeSiigoError(error: unknown) {
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
      : siigoErrorMessages(fetchError.data) || 'Siigo no pudo completar la consulta.',
    data: fetchError.data || fetchError.message
  })
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
