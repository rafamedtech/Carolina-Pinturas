import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createError, type H3Event } from 'h3'
import type { AppUser } from '~/types/siigo'
import type { ProductImage } from '~/types/siigo-products'
import { usePrisma } from './prisma'
import { getProductDetail } from './siigo-products'

export const PRODUCT_IMAGE_BUCKET = 'product-images'
export const PRODUCT_IMAGE_MAX_BYTES = 2 * 1024 * 1024

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const
type ProductImageType = keyof typeof EXTENSIONS

// The browser-declared MIME type is not trusted; the file signature decides.
export function detectProductImageType(bytes: Uint8Array): ProductImageType | undefined {
  const starts = (signature: number[], offset = 0) => signature.every((byte, index) => bytes[offset + index] === byte)
  if (starts([0xFF, 0xD8, 0xFF])) return 'image/jpeg'
  if (starts([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return 'image/png'
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp'
  return undefined
}

export function validateProductImage(bytes: Uint8Array | undefined): ProductImageType {
  if (!bytes?.length) throw createError({ statusCode: 400, statusMessage: 'Selecciona una imagen.' })
  if (bytes.length > PRODUCT_IMAGE_MAX_BYTES) throw createError({ statusCode: 413, statusMessage: 'La imagen no puede pesar más de 2 MB.' })
  const type = detectProductImageType(bytes)
  if (!type) throw createError({ statusCode: 415, statusMessage: 'Solo se permiten imágenes JPG, PNG o WebP.' })
  return type
}

function storageConfig(event?: H3Event) {
  const config = useRuntimeConfig(event)
  return { url: config.public.supabaseUrl, secretKey: config.supabaseSecretKey }
}

function productImageUrl(storagePath: string, event?: H3Event) {
  const { url } = storageConfig(event)
  const path = storagePath.split('/').map(encodeURIComponent).join('/')
  return `${url}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${path}`
}

function useStorage(event: H3Event) {
  const { url, secretKey } = storageConfig(event)
  if (!url || !secretKey) throw createError({ statusCode: 503, statusMessage: 'Falta configurar el almacenamiento de imágenes.' })
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(PRODUCT_IMAGE_BUCKET)
}

export async function getProductImage(productId: string, event?: H3Event): Promise<ProductImage | null> {
  const image = await usePrisma().productImage.findUnique({ where: { productId }, select: { storagePath: true, updatedAt: true } })
  return image ? { url: productImageUrl(image.storagePath, event), updatedAt: image.updatedAt.toISOString() } : null
}

export async function saveProductImage(event: H3Event, productId: string, bytes: Uint8Array | undefined, user: AppUser) {
  const contentType = validateProductImage(bytes)
  // Rejects ids that do not exist in Siigo, so no orphan images are stored.
  await getProductDetail(productId)
  const storage = useStorage(event)
  const prisma = usePrisma()
  const previous = await prisma.productImage.findUnique({ where: { productId }, select: { storagePath: true } })
  // A new path per upload keeps public URLs immutable and CDN-cacheable.
  const storagePath = `${productId}/${randomUUID()}.${EXTENSIONS[contentType]}`
  const { error: uploadError } = await storage.upload(storagePath, bytes!, { contentType, cacheControl: '31536000', upsert: false })
  if (uploadError) throw createError({ statusCode: 502, statusMessage: 'No se pudo subir la imagen. Intenta nuevamente.' })

  const data = { storagePath, contentType, sizeBytes: bytes!.length, uploadedByUserId: user.id }
  try {
    await prisma.productImage.upsert({ where: { productId }, create: { productId, ...data }, update: data })
  } catch (error) {
    await storage.remove([storagePath])
    throw error
  }
  if (previous) await storage.remove([previous.storagePath])
  return getProductImage(productId, event)
}

export async function deleteProductImage(event: H3Event, productId: string) {
  const storage = useStorage(event)
  const image = await usePrisma().productImage.delete({ where: { productId }, select: { storagePath: true } }).catch(() => null)
  if (!image) throw createError({ statusCode: 404, statusMessage: 'El producto no tiene imagen.' })
  await storage.remove([image.storagePath])
}
