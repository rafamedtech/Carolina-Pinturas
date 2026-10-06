import { createHash } from 'node:crypto'
import Decimal from 'decimal.js'
import { createError } from 'h3'
import type { Prisma } from '../../generated/prisma/client'
import type { AppUser, SiigoProduct } from '~/types/siigo'
import { mexicoToday } from '~/utils/datetime'
import type { PurchaseView } from '~/types/purchases'
import type { PurchaseCommand, PurchaseDraft } from '#shared/schemas/purchase'
import { usePrisma } from './prisma'
import { receiveInventory, voidReceiptInventory } from './inventory'
import { refreshProductCosts } from './product-costs'
import { getSiigoCustomerDetail } from './siigo-customer-detail'
import { getProductDetail } from './siigo-products'
import { upsertSiigoProduct } from './siigo-persistence'
import { purchaseAssert, purchaseBalance, purchaseLineTotal, assertReceipt } from './purchase-domain'

export const purchaseInclude = {
  items: { orderBy: { position: 'asc' as const } },
  receipts: { include: { items: true, warehouse: { select: { name: true } }, inventoryMovements: { select: { id: true, folio: true, type: true } } }, orderBy: { createdAt: 'asc' as const } },
  invoices: { include: { payments: { orderBy: { createdAt: 'asc' as const } } }, orderBy: { createdAt: 'asc' as const } },
  events: { orderBy: { createdAt: 'desc' as const } }
} satisfies Prisma.PurchaseOrderInclude
export type PurchaseRow = Prisma.PurchaseOrderGetPayload<{ include: typeof purchaseInclude }>
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue
const date = (s: string) => new Date(`${s}T00:00:00Z`)
const day = (d: Date) => d.toISOString().slice(0, 10)
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex')
export function purchaseView(row: PurchaseRow): PurchaseView {
  const invoices = row.invoices.map((i) => {
    const balance = i.voidedAt ? 0 : purchaseBalance(i.amount.toString(), i.payments).toNumber()
    const today = mexicoToday()
    return {
      id: i.id, folio: i.folio, date: day(i.date), dueDate: day(i.dueDate), amount: Number(i.amount), balance,
      status: i.voidedAt ? 'anulada' as const : balance === 0 ? 'liquidada' as const : day(i.dueDate) < today ? 'vencida' as const : 'pendiente' as const,
      voidedAt: i.voidedAt?.toISOString() ?? null, voidReason: i.voidReason,
      payments: i.payments.map(p => ({ id: p.id, date: day(p.date), amount: Number(p.amount), exchangeRate: Number(p.exchangeRate), method: p.method, voidedAt: p.voidedAt?.toISOString() ?? null, voidReason: p.voidReason }))
    }
  })
  const items = row.items.map(i => ({
    id: i.id, productId: i.productId, code: i.code, name: i.name, quantity: Number(i.quantity), unitCost: Number(i.unitCost), total: Number(i.total),
    received: row.receipts.filter(r => !r.voidedAt).flatMap(r => r.items).filter(r => r.itemId === i.id).reduce((s, r) => s.plus(r.quantity.toString()), new Decimal(0)).toNumber()
  }))
  return {
    id: row.id, folio: row.folio, version: row.version, status: row.status, date: day(row.date), currencyCode: row.currencyCode as 'MXN' | 'USD',
    providerId: row.providerId, providerName: row.providerName, providerRfc: row.providerRfc, total: Number(row.total), notes: row.notes,
    balance: invoices.reduce((s, i) => s.plus(i.balance), new Decimal(0)).toNumber(),
    invoiced: invoices.filter(i => !i.voidedAt).reduce((s, i) => s.plus(i.amount), new Decimal(0)).toNumber(),
    receiptStatus: items.every(i => i.received === i.quantity) ? 'completa' : items.some(i => i.received > 0) ? 'parcial' : 'pendiente', items, invoices,
    receipts: row.receipts.map(r => ({ warehouseId: r.warehouseId, warehouseName: r.warehouse?.name ?? null, inventoryMovements: r.inventoryMovements ?? [], id: r.id, date: day(r.date), voidedAt: r.voidedAt?.toISOString() ?? null, voidReason: r.voidReason, items: r.items.map(i => ({ itemId: i.itemId, quantity: Number(i.quantity) })) })),
    events: row.events.map(e => ({ id: e.id, action: e.action, createdBy: e.createdBy, createdAt: e.createdAt.toISOString(), detail: e.detail }))
  }
}
export async function getPurchase(id: string) {
  const row = await usePrisma().purchaseOrder.findUnique({ where: { id }, include: purchaseInclude })
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Orden de compra no encontrada.' })
  return row
}
async function prepareDraft(draft: PurchaseDraft) {
  const provider = await getSiigoCustomerDetail(draft.providerId)
  const local = await usePrisma().siigoCustomer.findUnique({ where: { id: draft.providerId } })
  purchaseAssert(local?.isSupplier && local.active !== false && provider.active !== false && provider.type?.toLowerCase() === 'supplier', 'Selecciona un proveedor activo clasificado como Supplier en Siigo.')
  // Sequential fresh reads keep Siigo requests bounded, outside the DB transaction.
  const products: SiigoProduct[] = []
  for (const item of draft.items) {
    const product = await getProductDetail(item.productId, true)
    purchaseAssert(product.active !== false, `Producto inactivo: ${product.name}.`)
    products.push(product)
  }
  const items = draft.items.map((item, position) => ({ ...item, position, code: products[position]!.code, name: products[position]!.name, productPayload: json(products[position]), total: purchaseLineTotal(item.quantity, item.unitCost).toString() }))
  const total = items.reduce((sum, i) => sum.plus(i.total), new Decimal(0))
  purchaseAssert(total.lte('9999999999999.99'), 'Total fuera de rango.')
  return { products, items, data: { providerId: provider.id, providerName: provider.name.join(' '), providerRfc: provider.rfc_id ?? null, providerPayload: json(provider), date: date(draft.date), currencyCode: draft.currencyCode, notes: draft.notes, total: total.toString() } }
}
async function replay(requestId: string, requestHash: string) {
  const event = await usePrisma().purchaseEvent.findUnique({ where: { requestId } })
  if (!event) return null
  purchaseAssert(event.requestHash === requestHash, 'Identificador de solicitud reutilizado con otros datos.')
  return purchaseView(await getPurchase(event.orderId))
}
async function persistProductSnapshots(products: SiigoProduct[]) {
  const prisma = usePrisma()
  // These catalog snapshots are idempotent and independent from the purchase.
  // Keeping their nested relation writes inside the interactive transaction can
  // exhaust its timeout before the order items are replaced.
  for (const product of products) await upsertSiigoProduct(prisma, product)
}
export async function createPurchase(input: { requestId: string, draft: PurchaseDraft }, user: AppUser) {
  const requestHash = hash({ actor: user.id, ...input })
  const prior = await replay(input.requestId, requestHash)
  if (prior) return prior
  const prepared = await prepareDraft(input.draft)
  await persistProductSnapshots(prepared.products)
  try {
    const id = await usePrisma().$transaction(async (tx) => {
      const row = await tx.purchaseOrder.create({ data: { ...prepared.data, createdBy: user.email, items: { create: prepared.items }, events: { create: { requestId: input.requestId, requestHash, action: 'create', detail: json(input.draft), createdBy: user.email } } } })
      return row.id
    }, { timeout: 15000 })
    return purchaseView(await getPurchase(id))
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      const result = await replay(input.requestId, requestHash)
      if (result) return result
    }
    throw error
  }
}
export async function mutatePurchase(id: string, input: PurchaseCommand, user: AppUser) {
  const requestHash = hash({ id, actor: user.id, ...input })
  const prior = await replay(input.requestId, requestHash)
  if (prior) return prior
  const c = input.command
  const before = await getPurchase(id)
  const prepared = c.action === 'edit' ? await prepareDraft(c.draft) : c.action === 'confirm' ? await prepareDraft({ providerId: before.providerId, date: day(before.date), currencyCode: before.currencyCode as 'MXN' | 'USD', notes: before.notes, items: before.items.map(i => ({ productId: i.productId, quantity: Number(i.quantity), unitCost: Number(i.unitCost) })) }) : null
  if (prepared) await persistProductSnapshots(prepared.products)
  try {
    await usePrisma().$transaction(async (tx) => {
      // This conditional UPDATE locks the order until commit. Every child write uses the same lock.
      const locked = await tx.purchaseOrder.updateMany({ where: { id, version: input.version }, data: { version: { increment: 1 } } })
      purchaseAssert(locked.count === 1, 'La compra cambió. Recarga antes de continuar.')
      const row = await tx.purchaseOrder.findUniqueOrThrow({ where: { id }, include: purchaseInclude })
      if (c.action === 'edit' || c.action === 'confirm') {
        purchaseAssert(row.status === 'borrador', 'Solo puedes modificar o confirmar borradores.')
        purchaseAssert(prepared, 'Faltan datos de la orden.')
        await tx.purchaseItem.deleteMany({ where: { orderId: id } })
        await tx.purchaseOrder.update({ where: { id }, data: { ...prepared.data, status: c.action === 'confirm' ? 'confirmada' : 'borrador', items: { create: prepared.items } } })
      } else if (c.action === 'cancel') {
        purchaseAssert(row.status !== 'cancelada' && !row.receipts.some(r => !r.voidedAt) && !row.invoices.some(i => !i.voidedAt), 'Anula primero recepciones y facturas vigentes.')
        await tx.purchaseOrder.update({ where: { id }, data: { status: 'cancelada' } })
      } else {
        purchaseAssert(row.status === 'confirmada', 'La orden debe estar confirmada.')
        if (c.action === 'receive') {
          assertReceipt(row.items, row.receipts, c.items)
          const receipt = await tx.purchaseReceipt.create({ data: { orderId: id, date: date(c.date), createdBy: user.email, items: { create: c.items } } })
          await receiveInventory(tx, receipt.id, c.warehouseId, user)
          await refreshProductCosts(tx, row.items.filter(i => c.items.some(l => l.itemId === i.id)).map(i => i.productId))
        } else if (c.action === 'voidReceipt') {
          purchaseAssert(row.receipts.some(r => r.id === c.id && !r.voidedAt), 'Recepción no vigente.')
          await voidReceiptInventory(tx, c.id, c.reason, user)
          await tx.purchaseReceipt.update({ where: { id: c.id }, data: { voidedAt: new Date(), voidReason: c.reason } })
          const receipt = row.receipts.find(r => r.id === c.id)!
          await refreshProductCosts(tx, row.items.filter(i => receipt.items.some(l => l.itemId === i.id)).map(i => i.productId))
        } else if (c.action === 'invoice' || c.action === 'editInvoice') {
          purchaseAssert(c.dueDate >= c.date, 'Vencimiento anterior a fecha de factura.')
          const invoiceId = c.action === 'editInvoice' ? c.id : undefined
          if (invoiceId) purchaseAssert(row.invoices.some(i => i.id === invoiceId && !i.voidedAt && !i.payments.some(p => !p.voidedAt)), 'Factura no editable: anula primero sus pagos.')
          // Serialize invoice folio checks across different orders of the same supplier.
          await tx.$queryRaw`SELECT id FROM siigo_customers WHERE id = ${row.providerId}::uuid FOR UPDATE`
          const duplicate = await tx.purchaseInvoice.findFirst({ where: { order: { providerId: row.providerId }, folio: { equals: c.folio, mode: 'insensitive' }, voidedAt: null, ...(invoiceId ? { id: { not: invoiceId } } : {}) } })
          purchaseAssert(!duplicate, 'Ya existe una factura vigente con este folio para el proveedor.')
          const data = { folio: c.folio, date: date(c.date), dueDate: date(c.dueDate), amount: c.amount }
          if (invoiceId) await tx.purchaseInvoice.update({ where: { id: invoiceId }, data })
          else await tx.purchaseInvoice.create({ data: { ...data, orderId: id, createdBy: user.email } })
        } else if (c.action === 'voidInvoice') {
          purchaseAssert(row.invoices.some(i => i.id === c.id && !i.voidedAt && !i.payments.some(p => !p.voidedAt)), 'Anula primero los pagos de esta factura.')
          await tx.purchaseInvoice.update({ where: { id: c.id }, data: { voidedAt: new Date(), voidReason: c.reason } })
        } else if (c.action === 'pay') {
          const invoice = row.invoices.find(i => i.id === c.invoiceId && !i.voidedAt)
          purchaseAssert(invoice, 'Factura no vigente.')
          purchaseAssert(purchaseBalance(invoice.amount.toString(), invoice.payments).gte(c.amount), 'El abono supera el saldo pendiente.')
          purchaseAssert(row.currencyCode !== 'MXN' || c.exchangeRate === 1, 'El tipo de cambio para MXN debe ser 1.')
          const payment = await tx.purchasePayment.create({ data: { invoiceId: invoice.id, date: date(c.date), amount: c.amount, exchangeRate: c.exchangeRate, method: c.method, createdBy: user.email } })
          await tx.expense.create({ data: {
            purchasePaymentId: payment.id, expenseDate: date(c.date), category: 'Compra de materiales', description: `Compra OC-${row.folio} / factura ${invoice.folio}`,
            providerId: row.providerId, providerNameSnapshot: row.providerName, providerRfcSnapshot: row.providerRfc, providerPayload: json(row.providerPayload),
            currencyCode: row.currencyCode, exchangeRate: c.exchangeRate, amount: c.amount, paymentMethod: c.method,
            createdByUserId: user.id, createdByName: user.name, createdByEmail: user.email, createdByRole: user.role
          } })
        } else if (c.action === 'voidPayment') {
          purchaseAssert(row.invoices.flatMap(i => i.payments).some(p => p.id === c.id && !p.voidedAt), 'Pago no vigente.')
          const removed = await tx.expense.deleteMany({ where: { purchasePaymentId: c.id } })
          purchaseAssert(removed.count === 1, 'El gasto vinculado requiere revisión antes de anular el pago.')
          await tx.purchasePayment.update({ where: { id: c.id }, data: { voidedAt: new Date(), voidReason: c.reason } })
        }
      }
      await tx.purchaseEvent.create({ data: { orderId: id, requestId: input.requestId, requestHash, action: c.action, detail: json(c), createdBy: user.email } })
    }, { timeout: 15000 })
  } catch (error) {
    const result = await replay(input.requestId, requestHash)
    if (result) return result
    throw error
  }
  return purchaseView(await getPurchase(id))
}
