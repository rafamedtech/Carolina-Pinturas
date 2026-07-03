const COOKIE_HEADER_SAFE_SIZE = 6000

function authStorageKey(supabaseUrl: string) {
  try {
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
    return projectRef ? `sb-${projectRef}-auth-token` : null
  } catch {
    return null
  }
}

function isStorageCookie(name: string, storageKey: string) {
  return name === storageKey
    || name.startsWith(`${storageKey}.`)
    || name === `${storageKey}-code-verifier`
    || name.startsWith(`${storageKey}-code-verifier.`)
}

interface ClearAuthCookiesOptions {
  onlyIfOversized?: boolean
}

export function clearStaleSupabaseAuthCookies(
  supabaseUrl: string,
  options: ClearAuthCookiesOptions = {}
) {
  const storageKey = authStorageKey(supabaseUrl)
  if (!storageKey) return

  const cookies = document.cookie
    .split(';')
    .map(cookie => cookie.trim().split('=', 1)[0])
    .filter((name): name is string => Boolean(name))
  const clearAllSupabaseSessions = new TextEncoder().encode(document.cookie).byteLength
    >= COOKIE_HEADER_SAFE_SIZE

  if (options.onlyIfOversized && !clearAllSupabaseSessions) return

  for (const name of cookies) {
    const isCurrentSession = isStorageCookie(name, storageKey)
    const isOversizedSupabaseSession = clearAllSupabaseSessions
      && name.startsWith('sb-')
      && name.includes('-auth-token')

    if (!isCurrentSession && !isOversizedSupabaseSession) continue

    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`
  }

  localStorage.removeItem(`${storageKey}-user`)
}
