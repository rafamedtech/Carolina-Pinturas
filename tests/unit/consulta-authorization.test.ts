import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { canAccessAppPath, canCreateOrders, canManageOrderLogistics, canWriteData } from '../../app/utils/roleAccess'

const mocks = vi.hoisted(() => ({ profile: vi.fn(), claims: vi.fn() }))
vi.mock('../../server/utils/prisma', () => ({ usePrisma: () => ({ appUser: { findUnique: mocks.profile } }) }))
vi.mock('../../server/utils/supabase', () => ({ getVerifiedSupabaseClaims: mocks.claims }))
vi.mock('h3', async original => ({
  ...await original<typeof import('h3')>(),
  getMethod: (event: { method: string }) => event.method,
  getRequestURL: (event: { path: string }) => new URL(event.path, 'http://localhost'),
  getQuery: (event: { path: string }) => Object.fromEntries(new URL(event.path, 'http://localhost').searchParams)
}))
vi.stubGlobal('createError', createError)
const { requireUser, requireRole } = await import('../../server/utils/auth')
const event = (method = 'GET', path = '/api/orders') => ({ method, path }) as never
beforeEach(() => {
  mocks.claims.mockResolvedValue({ sub: 'user' })
  mocks.profile.mockResolvedValue({ userId: 'user', name: 'Consulta', email: 'consulta@example.com', role: 'consulta', active: true })
})
describe('perfil solo consulta', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('bloquea %s antes de ejecutar la ruta', async (method) => {
    await expect(requireUser(event(method))).rejects.toMatchObject({ statusCode: 403 })
    await expect(requireRole(event(method), ['admin', 'vendedor'])).rejects.toMatchObject({ statusCode: 403 })
  })
  it.each(['/api/orders', '/api/purchases', '/api/reports/summary', '/api/inventory/valuation'])('permite leer %s', async (path) => {
    await expect(requireRole(event('GET', path), ['admin'])).resolves.toMatchObject({ role: 'consulta' })
  })
  it('bloquea sincronizaciones que escriben aunque usen GET', async () => {
    await expect(requireRole(event('GET', '/api/siigo/products?refresh=true'), ['admin'])).rejects.toMatchObject({ statusCode: 403 })
  })
  it('no permite consultar la administración de usuarios', async () => {
    await expect(requireRole(event('GET', '/api/users'), ['admin'])).rejects.toMatchObject({ statusCode: 403 })
  })
  it('revoca acceso al desactivar el perfil y reconoce cambios sin renovar JWT', async () => {
    mocks.profile.mockResolvedValue({ role: 'consulta', active: false })
    await expect(requireUser(event())).rejects.toMatchObject({ statusCode: 403 })
    mocks.profile.mockResolvedValue({ role: 'admin', active: true })
    await expect(requireRole(event('POST'), ['vendedor'])).resolves.toMatchObject({ role: 'admin' })
  })
  it.each(['/ventas/nuevo-pedido', '/ventas/nueva-cotizacion', '/compras/nueva', '/productos/nuevo', '/productos/product-id/editar', '/configuracion'])('bloquea la pantalla %s', (path) => {
    expect(canAccessAppPath('consulta', path)).toBe(false)
  })
  it('conserva navegación de consulta sin permisos de escritura', () => {
    for (const path of ['/', '/ventas', '/clientes/id', '/compras/id', '/reportes', '/inventario']) expect(canAccessAppPath('consulta', path)).toBe(true)
    expect(canWriteData('consulta')).toBe(false)
    expect(canWriteData(undefined)).toBe(false)
    expect(canWriteData('admin')).toBe(true)
    expect(canCreateOrders('consulta')).toBe(false)
    expect(canManageOrderLogistics('consulta')).toBe(false)
  })
})
