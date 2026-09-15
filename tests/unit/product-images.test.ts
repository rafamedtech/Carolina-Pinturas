import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import type { H3Event } from 'h3'
import type { AppUser } from '../../app/types/siigo'

const mocks = vi.hoisted(() => ({
  upload: vi.fn(), remove: vi.fn(), from: vi.fn(), createClient: vi.fn(),
  findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn(), detail: vi.fn(),
  config: { supabaseSecretKey: 'sb_secret_test', public: { supabaseUrl: 'https://demo.supabase.co' } }
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }))
vi.mock('../../server/utils/prisma', () => ({ usePrisma: () => ({ productImage: { findUnique: mocks.findUnique, upsert: mocks.upsert, delete: mocks.delete } }) }))
vi.mock('../../server/utils/siigo-products', () => ({ getProductDetail: mocks.detail }))
vi.mock('#app/nuxt', async importOriginal => ({ ...(await importOriginal<object>()), useRuntimeConfig: () => mocks.config }))
vi.stubGlobal('createError', createError)

const { detectProductImageType, validateProductImage, saveProductImage, deleteProductImage, getProductImage, PRODUCT_IMAGE_MAX_BYTES } = await import('../../server/utils/product-images')

const id = '00000000-0000-4000-8000-000000000001'
const user: AppUser = { id: '00000000-0000-4000-8000-000000000002', name: 'Admin', email: 'a@example.com', role: 'admin', repartidorId: null }
const event = {} as H3Event
const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0])
const jpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0])
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
const updatedAt = new Date('2026-09-15T12:00:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.config.supabaseSecretKey = 'sb_secret_test'
  mocks.from.mockReturnValue({ upload: mocks.upload, remove: mocks.remove })
  mocks.createClient.mockReturnValue({ storage: { from: mocks.from } })
  mocks.upload.mockResolvedValue({ error: null })
  mocks.remove.mockResolvedValue({ error: null })
  mocks.detail.mockResolvedValue({ id })
})

describe('validación de imágenes de producto', () => {
  it('detecta el tipo por firma, no por nombre', () => {
    expect(detectProductImageType(png)).toBe('image/png')
    expect(detectProductImageType(jpeg)).toBe('image/jpeg')
    expect(detectProductImageType(webp)).toBe('image/webp')
    expect(detectProductImageType(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeUndefined()
  })
  it('rechaza vacío, archivos grandes y formatos no permitidos', () => {
    expect(() => validateProductImage(undefined)).toThrow(expect.objectContaining({ statusCode: 400 }))
    const big = new Uint8Array(PRODUCT_IMAGE_MAX_BYTES + 1)
    big.set(png)
    expect(() => validateProductImage(big)).toThrow(expect.objectContaining({ statusCode: 413 }))
    expect(() => validateProductImage(new Uint8Array([1, 2, 3]))).toThrow(expect.objectContaining({ statusCode: 415 }))
  })
})

describe('almacenamiento de imágenes de producto', () => {
  it('sube con ruta nueva, guarda el registro y borra la imagen anterior', async () => {
    mocks.findUnique
      .mockResolvedValueOnce({ storagePath: `${id}/anterior.jpg` })
      .mockImplementationOnce(async () => ({ storagePath: mocks.upsert.mock.calls[0]![0].create.storagePath, updatedAt }))
    const result = await saveProductImage(event, id, png, user)
    const path = mocks.upload.mock.calls[0]![0] as string
    expect(path).toMatch(new RegExp(`^${id}/[0-9a-f-]{36}\\.png$`))
    expect(mocks.upload).toHaveBeenCalledWith(path, png, { contentType: 'image/png', cacheControl: '31536000', upsert: false })
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { productId: id }, update: { storagePath: path, contentType: 'image/png', sizeBytes: png.length, uploadedByUserId: user.id } }))
    expect(mocks.remove).toHaveBeenCalledWith([`${id}/anterior.jpg`])
    expect(result).toEqual({ url: `https://demo.supabase.co/storage/v1/object/public/product-images/${path}`, updatedAt: updatedAt.toISOString() })
  })
  it('no sube si el producto no existe en Siigo', async () => {
    mocks.detail.mockRejectedValue(createError({ statusCode: 404 }))
    await expect(saveProductImage(event, id, png, user)).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.upload).not.toHaveBeenCalled()
  })
  it('limpia el archivo nuevo si falla la base de datos', async () => {
    mocks.findUnique.mockResolvedValue(null)
    mocks.upsert.mockRejectedValue(new Error('db'))
    await expect(saveProductImage(event, id, png, user)).rejects.toThrow('db')
    expect(mocks.remove).toHaveBeenCalledWith([mocks.upload.mock.calls[0]![0]])
  })
  it('falla claro sin llave secreta o si Storage rechaza la subida', async () => {
    mocks.findUnique.mockResolvedValue(null)
    mocks.config.supabaseSecretKey = ''
    await expect(saveProductImage(event, id, png, user)).rejects.toMatchObject({ statusCode: 503 })
    mocks.config.supabaseSecretKey = 'sb_secret_test'
    mocks.upload.mockResolvedValue({ error: new Error('storage') })
    await expect(saveProductImage(event, id, png, user)).rejects.toMatchObject({ statusCode: 502 })
    expect(mocks.upsert).not.toHaveBeenCalled()
  })
  it('elimina registro y archivo; 404 si no hay imagen', async () => {
    mocks.delete.mockResolvedValueOnce({ storagePath: `${id}/foto.png` })
    await deleteProductImage(event, id)
    expect(mocks.remove).toHaveBeenCalledWith([`${id}/foto.png`])
    mocks.delete.mockRejectedValueOnce(new Error('not found'))
    await expect(deleteProductImage(event, id)).rejects.toMatchObject({ statusCode: 404 })
  })
  it('devuelve null cuando el producto no tiene imagen', async () => {
    mocks.findUnique.mockResolvedValue(null)
    await expect(getProductImage(id)).resolves.toBeNull()
  })
})
