import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'

const mocks = vi.hoisted(() => ({ role: vi.fn(), find: vi.fn(), update: vi.fn(), body: vi.fn() }))
vi.mock('../../server/utils/auth', () => ({ requireRole: mocks.role }))
vi.mock('../../server/utils/prisma', () => ({ usePrisma: () => ({ appUser: { findUnique: mocks.find, updateMany: mocks.update } }) }))
vi.stubGlobal('eventHandler', (handler: unknown) => handler)
vi.stubGlobal('createError', createError)
vi.stubGlobal('getRouterParam', () => '00000000-0000-4000-8000-000000000001')
vi.stubGlobal('readBody', mocks.body)
const { default: handler } = await import('../../server/api/users/[id].patch')
beforeEach(() => {
  vi.resetAllMocks()
  mocks.role.mockResolvedValue({ role: 'admin' })
  mocks.find.mockResolvedValue({ role: 'vendedor' })
  mocks.update.mockResolvedValue({ count: 1 })
  mocks.body.mockResolvedValue({ role: 'consulta', active: true })
})
describe('administración de permisos', () => {
  it('solo admite administradores y guarda un perfil limitado', async () => {
    await expect(handler({} as never)).resolves.toEqual({ success: true })
    expect(mocks.role).toHaveBeenCalledWith(expect.anything(), ['admin'])
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: expect.any(String), role: { not: 'admin' } }, data: { role: 'consulta', active: true } }))
  })
  it('no permite modificar ni desactivar administradores', async () => {
    mocks.find.mockResolvedValue({ role: 'admin' })
    mocks.body.mockResolvedValue({ role: 'consulta', active: false })
    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it.each([{ role: 'admin', active: true }, { role: 'inventado', active: true }, { role: 'consulta', active: 'true' }, { role: 'consulta', active: true, email: 'changed@example.com' }])('rechaza datos inválidos: %j', async (body) => {
    mocks.body.mockResolvedValue(body)
    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 400 })
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('rechaza cambios concurrentes que protegerían un nuevo administrador', async () => {
    mocks.update.mockResolvedValue({ count: 0 })
    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 409 })
  })
})
