import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { PrismaClient } from '../../generated/prisma/client'
import type { AppUser } from '../../app/types/siigo'
import type { PurchaseAction } from '../../shared/schemas/purchase'
import type { PurchaseView } from '../../app/types/purchases'

const { PrismaPg } = createRequire(import.meta.url)('@prisma/adapter-pg') as typeof import('@prisma/adapter-pg')

const mocks = vi.hoisted(() => ({ getPrisma: vi.fn(), supplier: vi.fn(), product: vi.fn() }))
vi.mock('../../server/utils/prisma', () => ({ usePrisma: mocks.getPrisma }))
vi.mock('../../server/utils/siigo-customer-detail', () => ({ getSiigoCustomerDetail: mocks.supplier }))
vi.mock('../../server/utils/siigo-products', () => ({ getProductDetail: mocks.product }))
const { createPurchase, mutatePurchase, getPurchase, purchaseView } = await import('../../server/utils/purchases')
// Opt-in only, an isolated local database; never read DATABASE_URL or real Siigo credentials.
const url = process.env.PURCHASE_TEST_DATABASE_URL
const suite = url ? describe : describe.skip
suite('compras: transacciones PostgreSQL con Siigo simulado', () => {
  let db: PrismaClient
  const providerId = randomUUID()
  const productId = randomUUID()
  const user: AppUser = { id: randomUUID(), name: 'Prueba compras', email: `purchase-${randomUUID()}@example.test`, role: 'admin', repartidorId: null }
  let order: PurchaseView
  const draft = { providerId, date: '2026-09-16', currencyCode: 'USD' as const, notes: '', items: [{ productId, quantity: 10, unitCost: 10.005 }] }
  const command = async (c: PurchaseAction) => {
    order = await mutatePurchase(order.id, { requestId: randomUUID(), version: order.version, command: c }, user)
    return order
  }
  beforeAll(async () => {
    const target = new URL(url!)
    if (!['127.0.0.1', 'localhost'].includes(target.hostname) || target.port !== '55439') throw new Error('Usa PostgreSQL temporal local en puerto 55439.')
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
    mocks.getPrisma.mockReturnValue(db)
    await db.appUser.create({ data: { userId: user.id, email: user.email, name: user.name, role: 'admin' } })
    await db.siigoCustomer.create({ data: { id: providerId, name: ['Proveedor prueba'], displayName: 'Proveedor prueba', type: 'Supplier', isSupplier: true, active: true, rawPayload: {} } })
    mocks.supplier.mockResolvedValue({ id: providerId, name: ['Proveedor prueba'], type: 'Supplier', active: true })
    mocks.product.mockResolvedValue({ id: productId, code: 'TEST', name: 'Producto prueba', active: true })
  })
  afterAll(async () => {
    if (!db) return
    const orders = await db.purchaseOrder.findMany({ where: { providerId }, select: { id: true } })
    const ids = orders.map(o => o.id)
    await db.expense.deleteMany({ where: { providerId } })
    await db.purchaseEvent.deleteMany({ where: { orderId: { in: ids } } })
    await db.purchasePayment.deleteMany({ where: { invoice: { orderId: { in: ids } } } })
    await db.purchaseInvoice.deleteMany({ where: { orderId: { in: ids } } })
    await db.purchaseReceiptItem.deleteMany({ where: { receipt: { orderId: { in: ids } } } })
    await db.purchaseReceipt.deleteMany({ where: { orderId: { in: ids } } })
    await db.purchaseItem.deleteMany({ where: { orderId: { in: ids } } })
    await db.purchaseOrder.deleteMany({ where: { providerId } })
    await db.siigoProduct.deleteMany({ where: { id: productId } })
    await db.siigoCustomer.delete({ where: { id: providerId } })
    await db.appUser.delete({ where: { userId: user.id } })
    await db.$disconnect()
  })
  it('crea una sola orden ante solicitudes concurrentes y rechaza reutilización distinta', async () => {
    const input = { requestId: randomUUID(), draft }
    const results = await Promise.all([createPurchase(input, user), createPurchase(input, user)])
    expect(results[0].id).toBe(results[1].id)
    order = results[0]
    expect(order.total).toBe(100.05)
    await expect(createPurchase({ ...input, draft: { ...draft, notes: 'Otro' } }, user)).rejects.toThrow()
    await command({ action: 'edit', draft: { ...draft, notes: 'Actualizada' } })
    await command({ action: 'confirm' })
    expect(order.status).toBe('confirmada')
    await expect(command({ action: 'edit', draft })).rejects.toThrow()
  })
  it('rechaza proveedor o producto inactivos y versiones obsoletas', async () => {
    mocks.product.mockResolvedValueOnce({ id: productId, code: 'TEST', name: 'Producto', active: false })
    await expect(createPurchase({ requestId: randomUUID(), draft }, user)).rejects.toThrow()
    mocks.supplier.mockResolvedValueOnce({ id: providerId, name: ['Proveedor'], type: 'Customer', active: true })
    await expect(createPurchase({ requestId: randomUUID(), draft }, user)).rejects.toThrow()
    await expect(mutatePurchase(order.id, { requestId: randomUUID(), version: 1, command: { action: 'cancel', reason: 'Prueba' } }, user)).rejects.toThrow()
  })
  it('serializa recepciones, no excede cantidad y anula correctamente', async () => {
    const version = order.version
    const results = await Promise.allSettled([1, 2].map(() => mutatePurchase(order.id, { requestId: randomUUID(), version, command: { action: 'receive', date: draft.date, items: [{ itemId: order.items[0]!.id, quantity: 6 }] } }, user)))
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    order = purchaseView(await getPurchase(order.id))
    expect(order.receiptStatus).toBe('parcial')
    await expect(command({ action: 'receive', date: draft.date, items: [{ itemId: order.items[0]!.id, quantity: 5 }] })).rejects.toThrow()
    await command({ action: 'receive', date: draft.date, items: [{ itemId: order.items[0]!.id, quantity: 4 }] })
    expect(order.receiptStatus).toBe('completa')
    await command({ action: 'voidReceipt', id: order.receipts[0]!.id, reason: 'Captura errónea' })
    expect(order.items[0]!.received).toBe(4)
    await expect(command({ action: 'cancel', reason: 'Prueba' })).rejects.toThrow()
  })
  it('varias facturas, vencimientos, pagos y gastos atómicos con reintento idéntico', async () => {
    await command({ action: 'invoice', folio: 'F-1', date: '2026-01-01', dueDate: '2026-01-02', amount: 60 })
    await command({ action: 'invoice', folio: 'F-2', date: draft.date, dueDate: '2099-01-01', amount: 40.05 })
    expect(order.invoices[0]!.status).toBe('vencida')
    expect(order.balance).toBe(100.05)
    const input = { requestId: randomUUID(), version: order.version, command: { action: 'pay' as const, invoiceId: order.invoices[0]!.id, date: draft.date, amount: 20, exchangeRate: 18.123456, method: 'transferencia' as const } }
    order = await mutatePurchase(order.id, input, user)
    await mutatePurchase(order.id, input, user)
    expect(await db.expense.count({ where: { providerId } })).toBe(1)
    const expense = await db.expense.findFirstOrThrow({ where: { providerId } })
    expect(Number(expense.exchangeRate)).toBe(18.123456)
    expect(expense.currencyCode).toBe('USD')
    expect(order.balance).toBe(80.05)
    await expect(command({ action: 'voidInvoice', id: order.invoices[0]!.id, reason: 'Prueba' })).rejects.toThrow()
    await expect(command({ action: 'editInvoice', id: order.invoices[0]!.id, folio: 'F-3', date: draft.date, dueDate: draft.date, amount: 1 })).rejects.toThrow()
    const version = order.version
    const results = await Promise.allSettled([1, 2].map(() => mutatePurchase(order.id, { ...input, requestId: randomUUID(), version, command: { ...input.command, amount: 30 } }, user)))
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    order = purchaseView(await getPurchase(order.id))
    await expect(command({ ...input.command, amount: 20 })).rejects.toThrow()
    expect(await db.expense.count({ where: { providerId } })).toBe(2)
    await command({ action: 'voidPayment', id: order.invoices[0]!.payments[0]!.id, reason: 'Corrección' })
    expect(await db.expense.count({ where: { providerId } })).toBe(1)
    expect(order.invoices[0]!.balance).toBe(30)
  })
  it('revierte pago si creación del gasto falla', async () => {
    const previous = order.version
    const count = await db.purchasePayment.count()
    const badUser = { ...user, id: randomUUID() }
    await expect(mutatePurchase(order.id, { requestId: randomUUID(), version: previous, command: { action: 'pay', invoiceId: order.invoices[1]!.id, date: draft.date, amount: 10, exchangeRate: 1, method: 'efectivo' } }, badUser)).rejects.toThrow()
    expect(await db.purchasePayment.count()).toBe(count)
    expect((await getPurchase(order.id)).version).toBe(previous)
  })
  it('MXN exige cambio uno, liquida y permite correcciones por anulación', async () => {
    order = await createPurchase({ requestId: randomUUID(), draft: { ...draft, currencyCode: 'MXN' } }, user)
    await command({ action: 'confirm' })
    await command({ action: 'invoice', folio: 'MX-1', date: draft.date, dueDate: draft.date, amount: 100 })
    const payment = { action: 'pay' as const, invoiceId: order.invoices[0]!.id, date: draft.date, amount: 100, exchangeRate: 18, method: 'efectivo' as const }
    await expect(command(payment)).rejects.toThrow()
    await command({ ...payment, exchangeRate: 1 })
    expect(order.invoices[0]!.status).toBe('liquidada')
    await command({ action: 'voidPayment', id: order.invoices[0]!.payments[0]!.id, reason: 'Prueba' })
    await command({ action: 'editInvoice', id: order.invoices[0]!.id, folio: 'MX-1', date: draft.date, dueDate: draft.date, amount: 90 })
    await command({ action: 'voidInvoice', id: order.invoices[0]!.id, reason: 'Prueba' })
    await command({ action: 'cancel', reason: 'Prueba finalizada' })
    expect(order.status).toBe('cancelada')
  })
  it('RLS activado y acceso directo cliente revocado en todas las tablas nuevas', async () => {
    const rows = await db.$queryRaw<Array<{ relname: string, relrowsecurity: boolean, allowed: boolean }>>`SELECT c.relname, c.relrowsecurity, has_table_privilege('authenticated', c.oid, 'SELECT') AS allowed FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname LIKE 'purchase_%'`
    expect(rows).toHaveLength(7)
    expect(rows.every(r => r.relrowsecurity && !r.allowed)).toBe(true)
  })
})
