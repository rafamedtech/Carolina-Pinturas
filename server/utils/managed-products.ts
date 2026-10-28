import { createError } from 'h3'
import type { ProductInput } from '#shared/schemas/product'
import { productInputSchema } from '#shared/schemas/product'
import type { SiigoProduct } from '~/types/siigo'
import { productMutationInput } from '../../app/utils/siigoProductMutation'
import { assertNoPendingProductWrites, attachProductCompositions, lockCompositions, validateComposition } from './product-compositions'
import { getProductDetail, listProducts, mutateProduct, validateProductReferences } from './siigo-products'
import { upsertSiigoProduct, siigoJson } from './siigo-persistence'
import { usePrisma } from './prisma'
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
  const input = productInputSchema.parse(write.input)
  const db = usePrisma()
  return db.$transaction(async (tx) => {
    // The persisted intent and local composition commit together.
    const locked = await tx.$queryRaw<Array<{ state: string }>>`SELECT state FROM product_writes WHERE id = ${write.id}::uuid FOR UPDATE`
    if (locked[0]?.state !== 'synced') {
      await persistInternalProduct(tx, input, product, write.isNew)
      await tx.productWrite.update({ where: { id: write.id }, data: { state: 'synced', productId: product.id } })
    }
    return (await attachProductCompositions(tx, [product]))[0]!
  }, { timeout: 20000 })
}
export async function saveManagedProduct(input: ProductInput, id?: string) {
  const db = usePrisma()
  const current = id ? await getProductDetail(id, true) : undefined
  if (current && current.type && current.type !== 'Product') throw createError({ statusCode: 422, statusMessage: 'Este tipo de producto se conserva solo para consulta histórica.' })
  if (current) await upsertSiigoProduct(db, current)
  // Internal settings can be committed without rewriting commercial data in Siigo.
  if (current && current.stock_control === false && canonical(productMutationInput(current)) === canonical(input)) {
    return db.$transaction(async (tx) => {
      await lockCompositions(tx, true)
      await assertNoPendingProductWrites(tx, [current])
      await persistInternalProduct(tx, input, current)
      return (await attachProductCompositions(tx, [current]))[0]!
    }, { timeout: 20000 })
  }
  await validateProductReferences(input, current)
  const write = await db.$transaction(async (tx) => {
    await validateComposition(tx, input.composition, id)
    const pending = await tx.productWrite.findFirst({ where: { state: { in: ['pending', 'unknown'] }, OR: [{ code: input.code }, ...(id ? [{ productId: id }] : [])] } })
    if (pending) throw createError({ statusCode: 409, statusMessage: 'Consulta el guardado pendiente antes de volver a guardar.', data: { ambiguous: true, operationId: pending.id } })
    return tx.productWrite.create({ data: { productId: id, isNew: !id, code: input.code, input: siigoJson(input) } })
  })
  let product: SiigoProduct | undefined
  try {
    product = await mutateProduct(input, id)
    if (id && product.id !== id) throw createError({ statusCode: 502, statusMessage: 'Siigo devolvió otro identificador de producto.' })
    return await finishWrite(write, product)
  } catch (error: unknown) {
    const failure = error as { statusCode?: number, statusMessage?: string, data?: { ambiguous?: boolean } }
    const ambiguous = Boolean(product) || (failure.data?.ambiguous ?? (!failure.statusCode || failure.statusCode >= 500))
    await db.productWrite.update({ where: { id: write.id }, data: { state: ambiguous ? 'unknown' : 'failed', ...(product && !id ? { productId: product.id } : {}) } }).catch(() => undefined)
    throw createError({ statusCode: ambiguous ? 502 : failure.statusCode, statusMessage: ambiguous ? 'El guardado necesita conciliación. Consulta el resultado antes de volver a guardar.' : failure.statusMessage,
      data: { ambiguous, operationId: write.id, productId: product?.id ?? id, code: input.code } })
  }
}
const canonical = (input: ProductInput) => JSON.stringify({
  ...input, composition: undefined, availability: undefined,
  taxes: input.taxes.map(t => t.id).sort((a, b) => a - b),
  prices: input.prices.map(p => ({ ...p, price_list: [...p.price_list].sort((a, b) => a.position - b.position) })).sort((a, b) => a.currency_code.localeCompare(b.currency_code))
})
export async function recoverProductWrite(id: string) {
  const write = await usePrisma().productWrite.findUniqueOrThrow({ where: { id } })
  const input = productInputSchema.parse(write.input)
  const matches = write.productId ? [await getProductDetail(write.productId, true)] : (await listProducts({ all: 'true', refresh: 'true', active: 'all', page: 1, page_size: 100, code: write.code })).results
  if (matches.length !== 1) throw createError({ statusCode: 409, statusMessage: 'No se encontró un producto único para conciliar. Conserva el guardado pendiente y revisa Siigo.' })
  const product = await getProductDetail(matches[0]!.id, true)
  if (product.type !== 'Product' || product.stock_control !== false || canonical(productMutationInput(product)) !== canonical(input)) {
    throw createError({ statusCode: 409, statusMessage: 'Siigo todavía no refleja los datos enviados. El guardado sigue pendiente; revisa el producto antes de intentar otra escritura.' })
  }
  return finishWrite(write, product)
}
