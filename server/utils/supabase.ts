import { createServerClient } from '@supabase/ssr'
import type { JwtPayload } from '@supabase/supabase-js'
import type { H3Event } from 'h3'

function supabaseConfig(event: H3Event) {
  const config = useRuntimeConfig(event)
  const url = config.public.supabaseUrl
  const publishableKey = config.public.supabasePublishableKey

  if (!url || !publishableKey) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Falta configurar Supabase Auth.'
    })
  }

  if (publishableKey.startsWith('sb_secret_')) {
    throw createError({
      statusCode: 500,
      statusMessage: 'La llave secreta de Supabase no puede exponerse como configuración pública.'
    })
  }

  return { url, publishableKey }
}

export function useServerSupabase(event: H3Event) {
  const { url, publishableKey } = supabaseConfig(event)

  return createServerClient(url, publishableKey, {
    cookies: {
      encode: 'tokens-only',
      getAll() {
        return Object.entries(parseCookies(event)).map(([name, value]) => ({
          name,
          value
        }))
      },
      setAll(cookies) {
        setHeader(event, 'Cache-Control', 'private, no-store')

        for (const { name, value, options } of cookies) {
          setCookie(event, name, value, options)
        }
      }
    }
  })
}

export async function getVerifiedSupabaseClaims(event: H3Event): Promise<JwtPayload | null> {
  const cachedAuth = event.context.supabaseAuth

  if (cachedAuth?.resolved) {
    return cachedAuth.claims
  }

  const { data, error } = await useServerSupabase(event).auth.getClaims()
  const claims = error ? null : data?.claims ?? null

  event.context.supabaseAuth = {
    resolved: true,
    claims
  }

  return claims
}
