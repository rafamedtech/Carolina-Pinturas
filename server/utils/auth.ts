import { getMethod, getRequestURL, getQuery } from 'h3'
import type { H3Event } from 'h3'
import { canWriteData } from '~/utils/roleAccess'
import type { AppUser, UserRole } from '~/types/siigo'
import { usePrisma } from './prisma'
import { getVerifiedSupabaseClaims } from './supabase'

function isRole(role: string): role is UserRole {
  return role === 'admin'
    || role === 'mostrador'
    || role === 'vendedor'
    || role === 'repartidor'
    || role === 'igualaciones'
    || role === 'consulta'
}

export async function getAppSession(event: H3Event): Promise<AppUser | null> {
  const claims = await getVerifiedSupabaseClaims(event)

  if (!claims?.sub) return null

  const profile = await usePrisma().appUser.findUnique({
    where: { userId: claims.sub },
    select: {
      userId: true,
      name: true,
      email: true,
      role: true,
      active: true,
      repartidor: {
        select: { id: true }
      }
    }
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
    role: profile.role,
    repartidorId: profile.repartidor?.id ?? null
  }
}

export async function requireUser(event: H3Event) {
  const user = await getAppSession(event)

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Inicia sesión para continuar.' })
  }

  if (!canWriteData(user.role) && (!['GET', 'HEAD', 'OPTIONS'].includes(getMethod(event)) || getQuery(event).refresh === 'true')) {
    throw createError({ statusCode: 403, statusMessage: 'Tu perfil es de solo consulta. No puedes agregar, modificar ni eliminar información.' })
  }

  return user
}

export async function requireRole(event: H3Event, roles: readonly UserRole[]) {
  const user = await requireUser(event)

  const canRead = user.role === 'consulta'
    && ['GET', 'HEAD'].includes(getMethod(event))
    && /^\/api\/(orders|purchases|reports|inventory|siigo|payments|products|dashboard|repartidores|expenses)(?:\/|$)/.test(getRequestURL(event).pathname)

  if (user.role !== 'admin' && !canRead && !roles.includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'No tienes permiso para esta operación.' })
  }

  return user
}
