import type { H3Event } from 'h3'
import type { AppUser, UserRole } from '~/types/siigo'
import { usePrisma } from './prisma'
import { getVerifiedSupabaseClaims } from './supabase'

function isRole(role: string): role is UserRole {
  return role === 'admin' || role === 'mostrador' || role === 'vendedor'
}

export async function getAppSession(event: H3Event): Promise<AppUser | null> {
  const claims = await getVerifiedSupabaseClaims(event)

  if (!claims?.sub) return null

  const profile = await usePrisma().appUser.findUnique({
    where: { userId: claims.sub }
  })

  if (!profile || !profile.active || !isRole(profile.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Tu usuario no está habilitado para acceder al panel.'
    })
  }

  return {
    id: profile.userId,
    name: profile.name,
    email: profile.email,
    role: profile.role
  }
}

export async function requireUser(event: H3Event) {
  const user = await getAppSession(event)

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Inicia sesión para continuar.' })
  }

  return user
}

export async function requireRole(event: H3Event, roles: UserRole[]) {
  const user = await requireUser(event)

  if (!roles.includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'No tienes permiso para esta operación.' })
  }

  return user
}
