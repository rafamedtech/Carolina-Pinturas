import { createError } from 'h3'
import { isDeepStrictEqual } from 'node:util'
import type { ProductInput } from '#shared/schemas/product'
import { productInputSchema } from '#shared/schemas/product'
import type { SiigoProduct } from '~/types/siigo'
import type { ProductWriteReview } from '~/types/siigo-products'
import { productMutationInput } from '../../app/utils/siigoProductMutation'
import { attachProductCompositions, lockCompositions, validateComposition } from './product-compositions'
import { getProductDetail, listProducts, mutateProduct, validateProductReferences } from './siigo-products'
import { upsertSiigoProduct, siigoJson } from './siigo-persistence'
import { usePrisma } from './prisma'
import { getStoredProduct } from './stored-products'
import type { Prisma, ProductWrite } from '../../generated/prisma/client'

async function persistInternalProduct(tx: Prisma.TransactionClient, input: ProductInput, product: SiigoProduct, isNew = false) {
  await validateComposition(tx, input.composition, isNew ? undefined : product.id)
  const previous = await tx.siigoProduct.findUnique({ where: { id: product.id }, select: { internalKind: true } })
  await upsertSiigoProduct(tx, product)
  await tx.siigoProduct.update({ where: { id: product.id }, data: {
    internalKind: input.composition.kind,
    availableForPurchase: input.availability.purchase,
    availableForSale: input.availability.sale,
    availableForExpense: input.availability.expense,
    compositionVersion: { increment: 1 },
    internalComponents: { deleteMany: {}, create: input.composition.components.map(c => ({ componentId: c.productId, quantity: c.quantity })) }
  } })
  if (input.composition.kind === 'composite') await tx.inventoryProduct.update({ where: { productId: product.id }, data: { enabled: false, version: { increment: 1 } } })
  else if (previous?.internalKind === 'composite') await tx.inventoryProduct.update({ where: { productId: product.id }, data: { enabled: true, version: { increment: 1 } } })
}

async function finishWrite(write: ProductWrite, product: SiigoProduct) {
  const statusInput = productStatusIntent(write.input)
  const input = statusInput ? undefined : productInputSchema.parse(write.input)
  if (statusInput && product.active !== statusInput.active) throw createError({ statusCode: 409, statusMessage: 'Siigo todavía no confirma el estado solicitado.' })
  const db = usePrisma()
  return db.$transaction(async (tx) => {
    // The persisted intent and local composition commit together.
    await lockCompositions(tx, true)
    const locked = await tx.$queryRaw<Array<{ state: string }>>`SELECT state FROM product_writes WHERE id = ${write.id}::uuid FOR UPDATE`
    if (!locked[0] || locked[0].state === 'failed') throw createError({ statusCode: 409, statusMessage: 'Este intento ya se cerró. Recarga el producto antes de guardar.' })
    if (locked[0]?.state !== 'synced') {
      if (statusInput) {
        // Status confirmation must not rebuild recipes or validate unrelated
        // commercial fields of an existing Siigo product.
        await upsertSiigoProduct(tx, product)
        if (!statusInput.active) await tx.siigoProduct.updateMany({
          where: { id: product.id, OR: [{ availableForPurchase: true }, { availableForSale: true }, { availableForExpense: true }] },
          data: { availableForPurchase: false, availableForSale: false, availableForExpense: false, compositionVersion: { increment: 1 } }
        })
      } else await persistInternalProduct(tx, input!, product, write.isNew)
      await tx.productWrite.update({ where: { id: write.id }, data: { state: 'synced', productId: product.id } })
    }
    return (await attachProductCompositions(tx, [product]))[0]!
  }, { timeout: 20000 })
}
interface ProductSaveOptions { statusOnly?: boolean }
function productStatusIntent(input: ProductWrite['input']) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.statusOnly !== true || typeof input.active !== 'boolean') return undefined
  return { active: input.active }
}

export async function saveManagedProduct(input: ProductInput, id?: string, replacesWriteId?: string, options: ProductSaveOptions = {}) {
  try {
    return await performProductSave(input, id, replacesWriteId, options)
  } catch (error: unknown) {
    const failure = error as { statusCode?: number, statusMessage?: string, data?: { ambiguous?: boolean } }
    if (failure.data?.ambiguous !== undefined) throw error
    // No remote write was attempted if preflight or reservation failed.
    throw createError({ statusCode: failure.statusCode || 502,
      statusMessage: failure.statusMessage || 'No se pudo iniciar el guardado. Vuelve a intentarlo.',
      data: { ambiguous: false, retryable: true } })
  }
}

async function performProductSave(input: ProductInput, id: string | undefined, replacesWriteId: string | undefined, options: ProductSaveOptions) {
  const db = usePrisma()
  if (options.statusOnly && !id) throw createError({ statusCode: 400, statusMessage: 'El cambio de estado requiere un producto existente.' })
  const matchesRequested = (product: SiigoProduct) => options.statusOnly ? product.active === input.active : matchesProductInput(product, input)
  let targetId = id
  // A manual retry of a creation must locate a possibly created product before
  // sending another POST. A product's code is unique in Siigo México.
  if (!targetId) {
    const previous = await db.productWrite.findFirst({ where: { code: input.code, isNew: true, state: 'failed' }, orderBy: { createdAt: 'desc' } })
    if (previous) {
      if (previous.productId) targetId = previous.productId
      else {
        const matches = (await listProducts({ code: input.code, active: 'all', refresh: 'true', page: 1, page_size: 100 })).results.filter(product => product.code === input.code)
        if (matches.length > 1) throw createError({ statusCode: 409, statusMessage: 'Siigo devolvió varios productos con el mismo código. Revisa el catálogo antes de guardar.' })
        targetId = matches[0]?.id
      }
    }
  }
  const current = targetId ? await getProductDetail(targetId, true) : undefined
  if (current && current.id !== targetId) throw createError({ statusCode: 502, statusMessage: 'Siigo devolvió otro identificador de producto.' })
  if (current && current.type && current.type !== 'Product') throw createError({ statusCode: 422, statusMessage: 'Este tipo de producto se conserva solo para consulta histórica.' })
  if (!id && current && !matchesProductInput(current, input)) throw createError({ statusCode: 409, statusMessage: 'El código ya existe en Siigo con datos distintos. Abre ese producto para modificarlo.' })
  if (!options.statusOnly) await validateProductReferences(input, current)
  const write = await db.$transaction(async (tx) => {
    await lockCompositions(tx, true)
    // Reserve the operation only. The product and its internal settings remain
    // untouched until Siigo confirms the complete commercial input.
    if (!options.statusOnly) await validateComposition(tx, input.composition, id)
    if (replacesWriteId) {
      const previous = await tx.productWrite.findUniqueOrThrow({ where: { id: replacesWriteId } })
      const locked = await tx.$queryRaw<Array<{ state: string, updatedAt: Date }>>`SELECT state, updated_at AS "updatedAt" FROM product_writes WHERE id = ${replacesWriteId}::uuid FOR UPDATE`
      if (previous.isNew || previous.productId !== id || !locked[0] || !['pending', 'unknown'].includes(locked[0].state) || locked[0].updatedAt.getTime() > Date.now() - PRODUCT_WRITE_WAIT_MS) {
        throw createError({ statusCode: 409, statusMessage: 'El intento cambió o todavía es reciente. Comprueba su resultado antes de volver a enviarlo.' })
      }
      await tx.productWrite.update({ where: { id: replacesWriteId }, data: { state: 'failed' } })
    }
    const pending = await tx.productWrite.findFirst({ where: { state: { in: ['pending', 'unknown'] }, OR: [{ code: input.code }, ...(targetId ? [{ productId: targetId }] : [])] } })
    if (pending) throw createError({ statusCode: 409, statusMessage: 'Hay otro guardado en curso. Comprueba su resultado antes de volver a guardar.', data: { ambiguous: true, operationId: pending.id } })
    return tx.productWrite.create({ data: { productId: targetId, isNew: !id, code: input.code, input: siigoJson({ ...input, ...(options.statusOnly ? { statusOnly: true } : {}) }) } })
  }, { timeout: 20000 })
  let remoteProductId = targetId
  let stage = 'siigo'
  try {
    let confirmed = current
    // A previous response may have been lost after Siigo applied the change.
    // The fresh preflight read confirms it without repeating the remote write.
    if (!confirmed || !matchesRequested(confirmed)) {
      const response = await mutateProduct(options.statusOnly ? { active: input.active } : input, targetId)
      if (targetId && response.id !== targetId) throw createError({ statusCode: 502, statusMessage: 'Siigo devolvió otro identificador de producto.' })
      remoteProductId = response.id
      confirmed = await getProductDetail(response.id, true)
      if (confirmed.id !== response.id || !matchesRequested(confirmed)) {
        throw createError({ statusCode: 502, statusMessage: 'Siigo todavía no confirma todos los cambios enviados.' })
      }
    }
    stage = 'local'
    return await finishWrite(write, confirmed)
  } catch (error: unknown) {
    const failure = error as { code?: string, statusCode?: number, statusMessage?: string, data?: { cause?: { statusCode: number, message: string } } }
    const cause = { stage, code: failure.code, ...failure.data?.cause,
      ...(!failure.data?.cause ? { statusCode: failure.statusCode, message: failure.statusMessage || (stage === 'local' ? 'No se pudo completar el guardado local del producto.' : 'Siigo no pudo confirmar el producto.') } : {}) }
    console.error('[managed-products] save failed', { operationId: write.id, productId: remoteProductId, ...cause })
    let retryable = false
    try {
      await db.productWrite.update({ where: { id: write.id }, data: { state: 'failed', ...(remoteProductId ? { productId: remoteProductId } : {}) } })
      retryable = true
    } catch { /* Keep the reservation if the database cannot close the operation. */ }
    throw createError({ statusCode: failure.statusCode || 502,
      statusMessage: retryable
        ? 'No se guardaron los cambios en la aplicación. Conservamos el formulario para que vuelvas a intentarlo; solo se guardará cuando Siigo confirme los datos.'
        : 'No se pudo cerrar el intento de guardado. Comprueba su resultado antes de volver a guardar.',
      data: { ambiguous: !retryable, retryable, operationId: write.id, productId: remoteProductId, code: input.code, cause } })
  }
}

const commercialSnapshot = (input: ProductInput) => ({
  code: input.code, name: input.name, account_group: input.account_group,
  type: input.type, active: input.active, stock_control: input.stock_control,
  tax_included: input.tax_included, unit: input.unit, key: input.key,
  reference: input.reference, description: input.description,
  additional_fields: { barcode: input.additional_fields.barcode, brand: input.additional_fields.brand },
  taxes: input.taxes.map(t => t.id).sort((a, b) => a - b),
  prices: input.prices.map(p => ({ currency_code: p.currency_code, price_list: p.price_list.map(item => ({ position: item.position, value: item.value })).sort((a, b) => a.position - b.position) })).sort((a, b) => a.currency_code.localeCompare(b.currency_code))
})
const matchesProductInput = (product: SiigoProduct, input: ProductInput) => isDeepStrictEqual(observedSnapshot(product), commercialSnapshot(input))
const observedSnapshot = (product: SiigoProduct) => ({ ...commercialSnapshot(productMutationInput(product)), type: product.type ?? 'Product', stock_control: product.stock_control })

async function closeUnchangedWrite(write: ProductWrite, product: SiigoProduct) {
  const db = usePrisma()
  return db.$transaction(async (tx) => {
    await lockCompositions(tx, true)
    const locked = await tx.$queryRaw<Array<{ state: string }>>`SELECT state FROM product_writes WHERE id = ${write.id}::uuid FOR UPDATE`
    if (!locked[0] || !['pending', 'unknown'].includes(locked[0].state)) throw createError({ statusCode: 409, statusMessage: 'El intento cambió. Comprueba su resultado.' })
    await upsertSiigoProduct(tx, product)
    await tx.productWrite.update({ where: { id: write.id }, data: { state: 'failed' } })
    // Preserve the local composition and availability; do not apply the failed input.
    return (await attachProductCompositions(tx, [product]))[0]!
  }, { timeout: 20000 })
}
const PRODUCT_WRITE_WAIT_MS = 5 * 60_000
async function inspectProductWrite(write: ProductWrite) {
  const input = productInputSchema.parse(write.input)
  const matches = write.productId ? [await getProductDetail(write.productId, true)] : (await listProducts({ all: 'true', refresh: 'true', active: 'all', page: 1, page_size: 100, code: write.code })).results
  if (matches.length !== 1) return { input, product: undefined, differences: [] }
  const product = write.productId ? matches[0]! : await getProductDetail(matches[0]!.id, true)
  if (write.productId && product.id !== write.productId) throw createError({ statusCode: 502, statusMessage: 'Siigo devolvió otro identificador de producto.' })
  const expected = commercialSnapshot(input)
  const actual = observedSnapshot(product)
  const differences = (Object.keys(expected) as Array<keyof typeof expected>).filter(key => (!productStatusIntent(write.input) || key === 'active') && JSON.stringify(expected[key]) !== JSON.stringify(actual[key]))
    .map(field => ({ field, expected: expected[field], actual: actual[field] }))
  return { input, product, differences }
}
export async function recoverProductWrite(id: string) {
  const write = await usePrisma().productWrite.findUniqueOrThrow({ where: { id } })
  if (write.state === 'failed') throw createError({ statusCode: 409, statusMessage: 'Este intento ya se cerró. Recarga el producto antes de guardar.' })
  const { product, differences } = await inspectProductWrite(write)
  if (!product) throw createError({ statusCode: 409, statusMessage: 'No se encontró un producto único para conciliar. Conserva el guardado pendiente y revisa Siigo.' })
  if (differences.length) {
    throw createError({ statusCode: 409, statusMessage: 'Siigo todavía no refleja los datos enviados. El guardado sigue pendiente; revisa el producto antes de intentar otra escritura.', data: { operationId: id, differences } })
  }
  return finishWrite(write, product)
}

/** A check may finish a confirmed local commit, but never repeats a Siigo mutation. */
export async function reviewProductWrite(id: string, followPending = true): Promise<ProductWriteReview> {
  const db = usePrisma()
  const write = await db.productWrite.findUniqueOrThrow({ where: { id } })
  // A retry response can be lost after reserving its replacement. Follow that
  // actual pending intent instead of unlocking from an obsolete operation id.
  if (followPending && ['failed', 'synced'].includes(write.state)) {
    const next = await db.productWrite.findFirst({ where: { id: { not: id }, state: { in: ['pending', 'unknown'] },
      OR: [...(write.productId ? [{ productId: write.productId }] : []), { code: write.code }] }, select: { id: true } })
    if (next) return reviewProductWrite(next.id, false)
  }
  const input = productInputSchema.parse(write.input)
  const availableAt = new Date(write.updatedAt.getTime() + PRODUCT_WRITE_WAIT_MS).toISOString()
  const components = input.composition.components.length ? await db.siigoProduct.findMany({ where: { id: { in: input.composition.components.map(item => item.productId) } }, select: { id: true, code: true, name: true } }) : []
  const componentLabels = Object.fromEntries(components.map(item => [item.id, `${item.code} · ${item.name}`]))
  const base = { operationId: id, productId: write.productId ?? undefined, isNew: write.isNew, input, componentLabels, differences: [], availableAt, canRetry: false, canDiscard: false }
  if (write.state === 'failed') {
    const local = write.productId ? await db.siigoProduct.findUnique({ where: { id: write.productId }, select: { compositionVersion: true } }) : null
    return { ...base, currentCompositionVersion: local?.compositionVersion, status: 'closed', message: 'Este intento ya se cerró. Puedes cargar sus cambios para revisarlos y guardarlos de nuevo.' }
  }
  if (write.state === 'synced' && write.productId) {
    const product = (await attachProductCompositions(db, [await getStoredProduct(db, write.productId)]))[0]!
    return { ...base, status: 'synced', product, message: 'El guardado ya está confirmado. El producto está disponible.' }
  }
  let inspected: Awaited<ReturnType<typeof inspectProductWrite>>
  try {
    inspected = await inspectProductWrite(write)
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode === 404) return { ...base, status: 'missing', message: 'El producto ya no aparece en Siigo. Revisa su código antes de crear otro producto.' }
    return { ...base, status: 'unavailable', message: (error as { statusMessage?: string }).statusMessage || 'No se pudo consultar Siigo. Tus cambios pendientes siguen conservados.' }
  }
  if (!inspected.product) return { ...base, status: 'missing', message: 'No se encontró un producto único en Siigo. Revisa su código en Siigo antes de crear otro producto.' }
  const local = write.productId ? await db.siigoProduct.findUnique({ where: { id: write.productId }, select: { compositionVersion: true } }) : null
  const currentCompositionVersion = local?.compositionVersion
  const canResolve = !write.isNew && Boolean(write.productId) && Date.now() >= Date.parse(availableAt)
  const previousCommercial = (write.input as Record<string, unknown>).previousCommercial
  if (canResolve && inspected.differences.length && previousCommercial
    // JSONB does not preserve object key order; compare JSON values structurally.
    && isDeepStrictEqual(JSON.parse(JSON.stringify(observedSnapshot(inspected.product))), previousCommercial)) {
    try {
      const product = await closeUnchangedWrite(write, inspected.product)
      return { ...base, status: 'reverted', product, message: 'No se guardaron los cambios. Siigo conserva los valores anteriores y se restauró el formulario.' }
    } catch { /* A concurrent resolution or local failure must keep the editor blocked. */ }
  }
  if (inspected.differences.length) return { ...base, currentCompositionVersion, differences: inspected.differences, status: 'different', canRetry: canResolve, canDiscard: canResolve,
    message: 'Siigo conserva datos distintos. Revisa la comparación y elige cómo resolver los cambios pendientes.' }
  try {
    const product = await finishWrite(write, inspected.product)
    return { ...base, status: 'synced', product, message: 'Siigo confirmó los cambios y el guardado quedó completado. El producto vuelve a estar disponible.' }
  } catch (error: unknown) {
    return { ...base, currentCompositionVersion, status: 'local_error', canDiscard: canResolve,
      message: (error as { statusMessage?: string }).statusMessage || 'Siigo confirmó los datos, pero no se pudo completar el guardado interno. Comprueba otra vez o carga los cambios para corregirlos.' }
  }
}

/** Only an explicit administrator action can replace an old edit and send it again. */
export async function retryProductWrite(id: string) {
  const write = await usePrisma().productWrite.findUniqueOrThrow({ where: { id } })
  if (write.isNew || !write.productId || !['pending', 'unknown'].includes(write.state)) throw createError({ statusCode: 409, statusMessage: 'Este intento no admite volver a enviarlo. Comprueba su resultado.' })
  const inspected = await inspectProductWrite(write)
  if (inspected.product && !inspected.differences.length) return finishWrite(write, inspected.product)
  if (!inspected.product) throw createError({ statusCode: 409, statusMessage: 'No se encontró el producto para volver a enviar los cambios.' })
  // Closing the old intent and reserving its replacement happen in one transaction.
  return saveManagedProduct(inspected.input, write.productId, id, { statusOnly: Boolean(productStatusIntent(write.input)) })
}

/** Explicitly close an old edit without replaying it or applying its internal settings. */
export async function discardProductWrite(id: string, productId: string) {
  const db = usePrisma()
  const write = await db.productWrite.findUniqueOrThrow({ where: { id } })
  if (write.isNew || write.productId !== productId) throw createError({ statusCode: 409, statusMessage: 'Solo puedes cerrar un intento de edición de este producto.' })
  // A recent operation may still be running. Never unlock a live mutation.
  if (write.updatedAt.getTime() > Date.now() - PRODUCT_WRITE_WAIT_MS) throw createError({ statusCode: 409, statusMessage: 'El guardado es reciente. Espera cinco minutos y consulta su resultado antes de desbloquearlo.' })
  const product = await getProductDetail(productId, true)
  if (product.id !== productId) throw createError({ statusCode: 502, statusMessage: 'Siigo devolvió otro identificador de producto.' })
  return db.$transaction(async (tx) => {
    await lockCompositions(tx, true)
    const locked = await tx.$queryRaw<Array<{ state: string, updatedAt: Date }>>`SELECT state, updated_at AS "updatedAt" FROM product_writes WHERE id = ${id}::uuid FOR UPDATE`
    const current = locked[0]
    if (!current || current.state === 'synced' || current.updatedAt.getTime() > Date.now() - PRODUCT_WRITE_WAIT_MS) throw createError({ statusCode: 409, statusMessage: 'El guardado cambió. Consulta su resultado antes de desbloquearlo.' })
    await upsertSiigoProduct(tx, product)
    await tx.productWrite.update({ where: { id }, data: { state: 'failed' } })
    return { productId }
  }, { timeout: 20000 })
}
