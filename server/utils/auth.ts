import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import type { AppUser, UserRole } from '~/types/siigo'

const COOKIE_NAME = 'carolina_pinturas_session'
const SESSION_SECONDS = 60 * 60 * 12

interface ConfiguredUser extends AppUser {
  passwordHash: string
}

interface SessionPayload extends AppUser {
  expiresAt: number
}

function encode(value: string) {
  return Buffer.from(value).toString('base64url')
}

function decode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function getSecret() {
  const secret = useRuntimeConfig().appSessionSecret

  if (!secret || secret.length < 32) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Falta configurar NUXT_APP_SESSION_SECRET.'
    })
  }

  return secret
}

function sign(payload: string) {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

function configuredUsers(): ConfiguredUser[] {
  const config = useRuntimeConfig()
  const encodedUsers = config.appUsersBase64
  const rawUsers = config.appUsers as unknown

  if (!encodedUsers && !rawUsers) return []

  try {
    const source = encodedUsers
      ? Buffer.from(encodedUsers, 'base64url').toString('utf8')
      : rawUsers
    const users = typeof source === 'string'
      ? JSON.parse(source) as ConfiguredUser[]
      : source as ConfiguredUser[]

    if (!Array.isArray(users)) {
      throw new Error('El valor no es un arreglo JSON.')
    }

    const validUsers = users.filter(user =>
      Boolean(user.name && user.email && user.passwordHash && isRole(user.role))
    )

    if (validUsers.length !== users.length) {
      throw new Error('Uno o más usuarios no tienen nombre, correo, rol o passwordHash válidos.')
    }

    return validUsers
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: encodedUsers
        ? 'NUXT_APP_USERS_BASE64 no contiene usuarios válidos.'
        : 'NUXT_APP_USERS debe ser un arreglo JSON válido en una sola línea.'
    })
  }
}

function isRole(role: unknown): role is UserRole {
  return role === 'admin' || role === 'mostrador' || role === 'vendedor'
}

function publicUser(user: ConfiguredUser): AppUser {
  return { name: user.name, email: user.email, role: user.role }
}

export function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, encodedSalt, encodedDigest] = encodedHash.split('$')

  if (algorithm !== 'scrypt' || !encodedSalt || !encodedDigest) return false

  const expected = Buffer.from(encodedDigest, 'base64url')
  const derived = scryptSync(password, Buffer.from(encodedSalt, 'base64url'), expected.length)

  return expected.length === derived.length && timingSafeEqual(expected, derived)
}

export function findUserByCredentials(email: string, password: string): AppUser | null {
  const user = configuredUsers().find(user => user.email.toLowerCase() === email.toLowerCase())

  if (!user || !verifyPassword(password, user.passwordHash)) return null

  return publicUser(user)
}

export function setSession(event: H3Event, user: AppUser) {
  const payload: SessionPayload = {
    ...user,
    expiresAt: Date.now() + SESSION_SECONDS * 1000
  }
  const encodedPayload = encode(JSON.stringify(payload))
  const token = `${encodedPayload}.${sign(encodedPayload)}`

  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_SECONDS
  })
}

export function clearAppSession(event: H3Event) {
  deleteCookie(event, COOKIE_NAME, { path: '/' })
}

export function getAppSession(event: H3Event): AppUser | null {
  const token = getCookie(event, COOKIE_NAME)
  if (!token) return null

  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature || signature !== sign(encodedPayload)) return null

  try {
    const payload = JSON.parse(decode(encodedPayload)) as SessionPayload

    if (!payload.expiresAt || payload.expiresAt < Date.now() || !isRole(payload.role)) return null

    return configuredUsers()
      .filter(user => user.email === payload.email)
      .map(publicUser)[0] || null
  } catch {
    return null
  }
}

export function requireUser(event: H3Event) {
  const user = getAppSession(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Inicia sesión para continuar.' })
  }
  return user
}

export function requireRole(event: H3Event, roles: UserRole[]) {
  const user = requireUser(event)
  if (!roles.includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'No tienes permiso para esta operación.' })
  }
  return user
}
