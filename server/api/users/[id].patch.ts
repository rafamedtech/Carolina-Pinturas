import { requireRole } from '../../utils/auth'
import { usePrisma } from '../../utils/prisma'
import { USER_ROLE_OPTIONS } from '~/utils/roleAccess'

export default eventHandler(async (event) => {
  await requireRole(event, ['admin'])
  const id = getRouterParam(event, 'id')
  if (!id || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Usuario inválido.' })
  }
  const body: unknown = await readBody(event)
  if (!body || typeof body !== 'object' || !('role' in body) || !('active' in body)
    || !USER_ROLE_OPTIONS.some(option => option.value === body.role) || typeof body.active !== 'boolean'
    || Object.keys(body).some(key => !['role', 'active'].includes(key))) {
    throw createError({ statusCode: 400, statusMessage: 'Selecciona un perfil válido y el estado de acceso.' })
  }
  const prisma = usePrisma()
  const profile = await prisma.appUser.findUnique({ where: { userId: id } })
  if (!profile) throw createError({ statusCode: 404, statusMessage: 'El usuario no existe.' })
  if (profile.role === 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'El administrador siempre conserva todos los permisos y su acceso activo.' })
  }
  // Include the role condition in the write to protect against concurrent changes.
  const result = await prisma.appUser.updateMany({
    where: { userId: id, role: { not: 'admin' } },
    data: { role: body.role as string, active: body.active }
  })
  if (!result.count) throw createError({ statusCode: 409, statusMessage: 'El perfil cambió. Actualiza la lista.' })
  return { success: true }
})
