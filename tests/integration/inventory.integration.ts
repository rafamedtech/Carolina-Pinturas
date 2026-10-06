import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import Decimal from 'decimal.js'
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest'
import { createError } from 'h3'
import { PrismaClient } from '../../generated/prisma/client'
import type { AppUser, SiigoProduct } from '../../app/types/siigo'
import type { InventoryCommand } from '../../shared/schemas/inventory'
import type { PurchaseAction } from '../../shared/schemas/purchase'
import { createOrderSchema, updateOrderSchema } from '../../server/utils/order-validation'

const require = createRequire(import.meta.url)
const { PrismaPg } = require('@prisma/adapter-pg') as typeof import('@prisma/adapter-pg')
const { Client } = require('pg') as typeof import('pg')

const mocks = vi.hoisted(() => ({ db: vi.fn(), supplier: vi.fn(), product: vi.fn() }))
vi.mock('../../server/utils/prisma', () => ({ usePrisma: mocks.db }))
vi.mock('../../server/utils/siigo-customer-detail', () => ({ getSiigoCustomerDetail: mocks.supplier }))
vi.mock('../../server/utils/siigo-products', () => ({ getProductDetail: mocks.product }))
vi.stubGlobal('createError', createError)
const { executeInventory, listInventory } = await import('../../server/utils/inventory')
const { createOrder, updateOrder, updateOrderStatus, updateOrderItemQuantity } = await import('../../server/utils/orders')
const { createPurchase, mutatePurchase } = await import('../../server/utils/purchases')
const { persistProductCatalog } = await import('../../server/utils/product-catalog-persistence')
const url = process.env.INVENTORY_TEST_DATABASE_URL
const suite = url ? describe : describe.skip
suite('inventario: PostgreSQL aislado, sin conexión Siigo', () => {
  const name = `inventory_test_${randomUUID().replaceAll('-', '')}`
  let adminConnection: InstanceType<typeof Client>
  let db: PrismaClient
  let a: string, b: string, initialProduct: string, serviceProduct: string, historicalProduct: string, legacyId: string
  let historicalPurchase: Awaited<ReturnType<typeof createPurchase>>
  const user: AppUser = { id: randomUUID(), name: 'Prueba Inventario', email: `${name}@example.test`, role: 'admin', repartidorId: null }
  const customer = { id: randomUUID(), name: ['Prueba inventario'], type: 'Supplier', active: true }
  const courier = { id: randomUUID(), nombre: 'Prueba', telefono: null, esMostrador: false }
  const counter = { id: randomUUID(), nombre: 'Mostrador prueba', telefono: null, esMostrador: true }
  const today = '2026-10-05'
  const command = (c: InventoryCommand['command'], actor = user) => executeInventory({ requestId: randomUUID(), command: c }, actor)
  const balance = (productId: string, warehouseId = a) => db.inventoryBalance.findUniqueOrThrow({ where: { warehouseId_productId: { warehouseId, productId } } })
  async function product(type = 'Product') {
    const id = randomUUID()
    await db.siigoProduct.create({ data: { id, code: id.slice(0, 8), name: 'Pintura prueba', type, stockControl: false, active: true, rawPayload: {} } })
    return id
  }
  async function entry(productId: string, quantity = '10', warehouseId = a) {
    return command({ action: 'move', type: 'entrada', warehouseId, date: today, reason: 'Entrada de prueba', lines: [{ productId, quantity }] })
  }
  async function sale(productId: string, quantity: number, statusKey = 'confirmado', direct = false, requestId = randomUUID(), paid = false) {
    const p = await db.siigoProduct.findUniqueOrThrow({ where: { id: productId } })
    const snapshot: SiigoProduct = { id: p.id, name: p.name, code: p.code, type: p.type ?? 'Product', active: true, stock_control: false, prices: [{ currency_code: 'MXN', price_list: [{ position: 1, value: 10 }] }] }
    const reparto = direct ? counter : courier
    return createOrder(createOrderSchema.parse({ requestId, customerId: customer.id, warehouseId: a, repartidorId: reparto.id, statusKey, orderDate: today, ...(paid ? { initialPayment: { requestId, paymentMethod: 'efectivo', date: today } } : {}), lines: [{ productId, quantity }] }), user, customer, new Map([[productId, snapshot]]), reparto)
  }
  const transition = async (id: string, statusKey: string) => {
    const order = await db.salesOrder.findUniqueOrThrow({ where: { id } })
    return updateOrderStatus(id, { statusKey, version: order.version }, user)
  }
  beforeAll(async () => {
    const target = new URL(url!)
    if (!['127.0.0.1', 'localhost'].includes(target.hostname)) throw new Error('Las pruebas solo permiten PostgreSQL local.')
    adminConnection = new Client({ connectionString: url })
    await adminConnection.connect()
    await adminConnection.query(`CREATE DATABASE "${name}"`)
    target.pathname = `/${name}`
    const setup = new Client({ connectionString: target.toString() })
    await setup.connect()
    try {
      const ddl = execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script'], { encoding: 'utf8' })
      await setup.query(ddl)
      const migration = readFileSync('supabase/migrations/20261005171346_internal_inventory.sql', 'utf8')
      await setup.query(migration.slice(migration.indexOf('INSERT INTO public.inventory_settings')))
    } finally { await setup.end() }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.toString(), max: 8 }) })
    mocks.db.mockReturnValue(db)
    await db.appUser.create({ data: { userId: user.id, name: user.name, email: user.email, role: user.role } })
    await db.siigoCustomer.create({ data: { id: customer.id, name: customer.name, displayName: customer.name[0]!, type: 'Supplier', isCustomer: true, isSupplier: true, active: true, rawPayload: {} } })
    await db.repartidor.createMany({ data: [{ ...courier, activo: true }, { ...counter, activo: true }] })
    await db.orderStatus.createMany({ data: ['borrador', 'ingresado', 'confirmado', 'surtido', 'en_espera', 'en_camino', 'entregado', 'cancelado'].map((key, index) => ({ key, label: key, sortOrder: index })) })
    a = (await command({ action: 'warehouse', code: 'A', name: 'Principal', address: '', active: true }) as { id: string }).id
    b = (await command({ action: 'warehouse', code: 'B', name: 'Secundario', address: '', active: true }) as { id: string }).id
    initialProduct = await product()
    serviceProduct = await product('Service')
    await command({ action: 'move', type: 'inicial', warehouseId: a, date: today, reason: 'Conteo inicial', lines: [{ productId: initialProduct, quantity: '10.123456' }] })
    legacyId = (await sale(initialProduct, 2, 'entregado', true)).id
    historicalProduct = await product()
    mocks.supplier.mockResolvedValue(customer)
    mocks.product.mockResolvedValue({ id: historicalProduct, code: 'HIST', name: 'Producto histórico', active: true })
    historicalPurchase = await createPurchase({ requestId: randomUUID(), draft: { providerId: customer.id, date: today, currencyCode: 'MXN', notes: '', items: [{ productId: historicalProduct, quantity: 3, unitCost: 10 }] } }, user)
    historicalPurchase = await mutatePurchase(historicalPurchase.id, { requestId: randomUUID(), version: historicalPurchase.version, command: { action: 'confirm' } }, user)
    historicalPurchase = await mutatePurchase(historicalPurchase.id, { requestId: randomUUID(), version: historicalPurchase.version, command: { action: 'receive', date: today, items: [{ itemId: historicalPurchase.items[0]!.id, quantity: 1 }] } }, user)
    const initialCount = await command({ action: 'countCreate', warehouseId: b, date: today, reason: 'Conteo inicial real' }) as { id: string }
    for (const productId of [initialProduct, historicalProduct]) {
      const current = await db.inventoryCount.findUniqueOrThrow({ where: { id: initialCount.id } })
      await command({ action: 'countAdd', id: current.id, version: current.version, productId })
    }
    let count = await db.inventoryCount.findUniqueOrThrow({ where: { id: initialCount.id }, include: { lines: true } })
    await command({ action: 'countEdit', id: count.id, version: count.version, lines: count.lines.map(l => ({ productId: l.productId, counted: '1.250001' })) })
    count = await db.inventoryCount.findUniqueOrThrow({ where: { id: count.id }, include: { lines: true } })
    await command({ action: 'countSubmit', id: count.id, version: count.version })
    count = await db.inventoryCount.findUniqueOrThrow({ where: { id: count.id }, include: { lines: true } })
    await command({ action: 'countApply', id: count.id, version: count.version })
    await command({ action: 'activate', version: 1 })
  })
  it('solo las nuevas recepciones de compras históricas generan inventario tras la activación', async () => {
    const legacyReceipt = historicalPurchase.receipts[0]!
    expect(await db.inventoryMovement.count({ where: { receiptId: legacyReceipt.id } })).toBe(0)
    historicalPurchase = await mutatePurchase(historicalPurchase.id, { requestId: randomUUID(), version: historicalPurchase.version, command: { action: 'receive', warehouseId: b, date: today, items: [{ itemId: historicalPurchase.items[0]!.id, quantity: 1 }] } }, user)
    expect((await balance(historicalProduct, b)).quantity.toString()).toBe('2.250001')
    historicalPurchase = await mutatePurchase(historicalPurchase.id, { requestId: randomUUID(), version: historicalPurchase.version, command: { action: 'voidReceipt', id: legacyReceipt.id, reason: 'Anulación histórica' } }, user)
    expect((await balance(historicalProduct, b)).quantity.toString()).toBe('2.250001')
    expect(await db.inventoryMovement.count({ where: { receiptId: legacyReceipt.id } })).toBe(0)
  })
  afterAll(async () => {
    if (db) await db.$disconnect()
    if (adminConnection) {
      await adminConnection.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
      await adminConnection.end()
    }
  })
  it('conserva seis decimales, excluye servicios y no hereda stock_control de Siigo', async () => {
    expect((await balance(initialProduct)).quantity.toString()).toBe('10.123456')
    expect((await balance(initialProduct, b)).quantity.toString()).toBe('1.250001')
    expect((await db.inventorySettings.findUniqueOrThrow({ where: { id: 1 } })).enabledAt).not.toBeNull()
    expect((await db.inventoryProduct.findUniqueOrThrow({ where: { productId: initialProduct } })).enabled).toBe(true)
    expect((await db.inventoryProduct.findUniqueOrThrow({ where: { productId: serviceProduct } })).enabled).toBe(false)
    expect(await db.inventoryMovement.count({ where: { orderId: legacyId } })).toBe(0)
    await transition(legacyId, 'cancelado')
    expect((await balance(initialProduct)).quantity.toString()).toBe('10.123456')
    await expect(command({ action: 'move', type: 'inicial', warehouseId: a, date: today, reason: 'Segundo saldo', lines: [{ productId: initialProduct, quantity: '1' }] })).rejects.toThrow()
  })
  it('serializa reservas concurrentes, libera al cancelar y no permite sobreventa', async () => {
    const id = await product()
    await entry(id)
    const results = await Promise.allSettled([sale(id, 6), sale(id, 6)])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect((await balance(id)).reserved.toString()).toBe('6')
    const winner = results.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof sale>>>
    await transition(winner.value.id, 'cancelado')
    expect((await balance(id)).reserved.toString()).toBe('0')
    expect(await db.inventoryReservation.count({ where: { productId: id } })).toBe(0)
  })
  it('recalcula reservas al editar y protege cantidades después de surtir', async () => {
    const id = await product()
    await entry(id)
    const order = await sale(id, 3)
    const item = order.items[0]!
    const updated = await updateOrderItemQuantity(order.id, item.id, { quantity: 4, version: order.version }, user)
    expect((await balance(id)).reserved.toString()).toBe('4')
    await updateOrderStatus(order.id, { statusKey: 'surtido', version: updated.version }, user)
    expect((await balance(id)).quantity.toString()).toBe('6')
    expect((await balance(id)).reserved.toString()).toBe('0')
    const after = await db.salesOrder.findUniqueOrThrow({ where: { id: order.id } })
    await expect(updateOrderItemQuantity(order.id, item.id, { quantity: 5, version: after.version }, user)).rejects.toThrow()
    await expect(transition(order.id, 'confirmado')).rejects.toThrow()
    await transition(order.id, 'en_camino')
    await transition(order.id, 'entregado')
    expect(await db.inventoryMovement.count({ where: { orderId: order.id, type: 'surtido' } })).toBe(1)
  })
  it('editar partidas reemplazadas y almacén conserva reservas por producto', async () => {
    const id = await product()
    await entry(id)
    await entry(id, '10', b)
    const order = await sale(id, 3)
    const p = await db.siigoProduct.findUniqueOrThrow({ where: { id } })
    const snapshot = { id, name: p.name, code: p.code, active: true, prices: [{ currency_code: 'MXN', price_list: [{ position: 1, value: 10 }] }] }
    await updateOrder(order.id, updateOrderSchema.parse({ customerId: customer.id, repartidorId: courier.id, warehouseId: b, version: order.version, orderDate: today, paymentStatus: order.paymentStatus, lines: [{ productId: id, quantity: 5 }] }), user, customer, new Map([[id, snapshot]]), courier)
    expect((await balance(id, a)).reserved.toString()).toBe('0')
    expect((await balance(id, b)).reserved.toString()).toBe('5')
    await transition(order.id, 'cancelado')
  })
  it('venta de mostrador y reintentos crean una sola salida; pago y faltantes son atómicos', async () => {
    const id = await product()
    await entry(id)
    const requestId = randomUUID()
    const result = await Promise.all([sale(id, 4, 'confirmado', true, requestId, true), sale(id, 4, 'confirmado', true, requestId, true)])
    expect(result[0]!.id).toBe(result[1]!.id)
    expect(result[0]!.status.key).toBe('entregado')
    expect((await balance(id)).quantity.toString()).toBe('6')
    expect(await db.salesOrderPayment.count({ where: { orderId: result[0]!.id, provider: 'local' } })).toBe(1)
    const rejectedRequest = randomUUID()
    await expect(sale(id, 9, 'confirmado', true, rejectedRequest, true)).rejects.toThrow()
    expect(await db.salesOrderPayment.count({ where: { requestId: rejectedRequest } })).toBe(0)
    expect(await db.inventoryEvent.count({ where: { requestId: rejectedRequest } })).toBe(0)
    expect(await db.salesOrder.count({ where: { items: { some: { productId: id } } } })).toBe(1)
  })
  it('en espera conserva reservas o salidas y llegar directamente a en camino descuenta una vez', async () => {
    const id = await product()
    await entry(id)
    const order = await sale(id, 3, 'ingresado')
    expect((await balance(id)).reserved.toString()).toBe('0')
    await transition(order.id, 'en_espera')
    expect((await balance(id)).reserved.toString()).toBe('0')
    await transition(order.id, 'confirmado')
    await transition(order.id, 'en_espera')
    expect((await balance(id)).reserved.toString()).toBe('3')
    await transition(order.id, 'en_camino')
    await transition(order.id, 'en_espera')
    expect((await balance(id)).quantity.toString()).toBe('7')
    expect((await balance(id)).reserved.toString()).toBe('0')
    await transition(order.id, 'entregado')
    expect(await db.inventoryMovement.count({ where: { orderId: order.id, type: 'surtido' } })).toBe(1)
  })
  it('agrupa partidas repetidas y permite pedidos de servicios sin almacén ni existencias', async () => {
    const id = await product()
    await entry(id, '5')
    const snapshot: SiigoProduct = { id, code: id.slice(0, 8), name: 'Pintura duplicada', active: true, prices: [{ currency_code: 'MXN', price_list: [{ position: 1, value: 10 }] }] }
    const input = { requestId: randomUUID(), customerId: customer.id, warehouseId: a, repartidorId: courier.id, statusKey: 'confirmado', orderDate: today, lines: [{ productId: id, quantity: 2 }, { productId: id, quantity: 3 }] }
    const order = await createOrder(createOrderSchema.parse(input), user, customer, new Map([[id, snapshot]]), courier)
    expect((await balance(id)).reserved.toString()).toBe('5')
    expect(await db.inventoryReservation.count({ where: { orderId: order.id } })).toBe(1)
    await expect(createOrder(createOrderSchema.parse({ ...input, requestId: randomUUID(), lines: [{ productId: id, quantity: 1 }, { productId: id, quantity: 1 }] }), user, customer, new Map([[id, snapshot]]), courier)).rejects.toThrow()
    await transition(order.id, 'surtido')
    expect((await balance(id)).quantity.toString()).toBe('0')
    const dispatched = await db.salesOrder.findUniqueOrThrow({ where: { id: order.id } })
    await expect(updateOrder(order.id, updateOrderSchema.parse({ customerId: customer.id, repartidorId: courier.id, warehouseId: a, version: dispatched.version, orderDate: today, lines: [{ productId: id, quantity: 1 }, { productId: id, quantity: 4 }] }), user, customer, new Map([[id, snapshot]]), courier)).rejects.toThrow('después del surtido')
    const service: SiigoProduct = { ...snapshot, id: serviceProduct, code: 'SERV', type: 'Service' }
    const serviceOrder = await createOrder(createOrderSchema.parse({ ...input, requestId: randomUUID(), warehouseId: null, lines: [{ productId: serviceProduct, quantity: 1 }] }), user, customer, new Map([[serviceProduct, service]]), courier)
    await transition(serviceOrder.id, 'entregado')
    expect(await db.inventoryReservation.count({ where: { orderId: serviceOrder.id } })).toBe(0)
    expect(await db.inventoryMovement.count({ where: { orderId: serviceOrder.id } })).toBe(0)
  })
  it('cancelar no devuelve stock; devoluciones parciales están limitadas a lo surtido', async () => {
    const id = await product()
    await entry(id)
    const order = await sale(id, 4, 'entregado', true)
    await transition(order.id, 'cancelado')
    expect((await balance(id)).quantity.toString()).toBe('6')
    const movement = await db.inventoryMovement.findUniqueOrThrow({ where: { originKey: `order:${order.id}:dispatch` } })
    await command({ action: 'return', sourceMovementId: movement.id, warehouseId: a, date: today, reason: 'Devolución parcial', lines: [{ productId: id, quantity: '2' }] })
    expect((await balance(id)).quantity.toString()).toBe('8')
    await expect(command({ action: 'return', sourceMovementId: movement.id, warehouseId: a, date: today, reason: 'Excede lo surtido', lines: [{ productId: id, quantity: '3' }] })).rejects.toThrow()
  })
  it('recepciones parciales, devoluciones a proveedor y anulación afectan stock sin tocar pagos', async () => {
    const id = await product()
    mocks.supplier.mockResolvedValue(customer)
    const p = await db.siigoProduct.findUniqueOrThrow({ where: { id } })
    mocks.product.mockResolvedValue({ id, code: p.code, name: p.name, active: true })
    let purchase = await createPurchase({ requestId: randomUUID(), draft: { providerId: customer.id, date: today, currencyCode: 'MXN', notes: '', items: [{ productId: id, quantity: 10, unitCost: 10 }] } }, user)
    const act = async (c: PurchaseAction) => {
      purchase = await mutatePurchase(purchase.id, { requestId: randomUUID(), version: purchase.version, command: c }, user)
    }
    await act({ action: 'confirm' })
    await expect(act({ action: 'receive', date: today, items: [{ itemId: purchase.items[0]!.id, quantity: 6 }] })).rejects.toThrow()
    await act({ action: 'receive', warehouseId: a, date: today, items: [{ itemId: purchase.items[0]!.id, quantity: 6 }] })
    expect((await balance(id)).quantity.toString()).toBe('6')
    const receipt = purchase.receipts[0]!
    const movement = await db.inventoryMovement.findUniqueOrThrow({ where: { originKey: `receipt:${receipt.id}` } })
    const returned = await command({ action: 'return', sourceMovementId: movement.id, warehouseId: a, date: today, reason: 'Devolver a proveedor', lines: [{ productId: id, quantity: '2' }] }) as { id: string }
    expect((await balance(id)).quantity.toString()).toBe('4')
    await expect(act({ action: 'voidReceipt', id: receipt.id, reason: 'Corrección de recepción' })).rejects.toThrow()
    await command({ action: 'reverse', movementId: returned.id, date: today, reason: 'Corrección de devolución' })
    await act({ action: 'voidReceipt', id: receipt.id, reason: 'Corrección de recepción' })
    expect((await balance(id)).quantity.toString()).toBe('0')
    expect(purchase.invoices).toHaveLength(0)
  })
  it('rechaza anular entradas consumidas/reservadas; traspasos y reversiones son atómicos', async () => {
    const id = await product()
    await entry(id)
    const input: InventoryCommand = { requestId: randomUUID(), command: { action: 'move', type: 'traspaso', warehouseId: a, destinationId: b, date: today, reason: 'Traspaso de prueba', lines: [{ productId: id, quantity: '3' }] } }
    const moves = await Promise.all([executeInventory(input, user), executeInventory(input, user)]) as Array<{ id: string }>
    expect(moves[0]!.id).toBe(moves[1]!.id)
    expect((await balance(id)).quantity.toString()).toBe('7')
    expect((await balance(id, b)).quantity.toString()).toBe('3')
    await expect(command({ ...input.command as Extract<InventoryCommand['command'], { action: 'move' }>, lines: [{ productId: id, quantity: '8' }] })).rejects.toThrow()
    expect((await balance(id, b)).quantity.toString()).toBe('3')
    await command({ action: 'reverse', movementId: moves[0]!.id, date: today, reason: 'Corrección de traspaso' })
    expect((await balance(id)).quantity.toString()).toBe('10')
    await expect(executeInventory({ ...input, command: { ...input.command as Extract<InventoryCommand['command'], { action: 'move' }>, reason: 'Solicitud distinta' } }, user)).rejects.toThrow()
  })
  it('anular una recepción rechaza stock reservado o consumido y revierte íntegramente el documento', async () => {
    const id = await product()
    mocks.supplier.mockResolvedValue(customer)
    mocks.product.mockResolvedValue({ id, code: id.slice(0, 8), name: 'Pintura prueba', active: true })
    let purchase = await createPurchase({ requestId: randomUUID(), draft: { providerId: customer.id, date: today, currencyCode: 'MXN', notes: '', items: [{ productId: id, quantity: 5, unitCost: 10 }] } }, user)
    const act = async (c: PurchaseAction) => {
      purchase = await mutatePurchase(purchase.id, { requestId: randomUUID(), version: purchase.version, command: c }, user)
    }
    await act({ action: 'confirm' })
    await act({ action: 'receive', warehouseId: a, date: today, items: [{ itemId: purchase.items[0]!.id, quantity: 5 }] })
    const receipt = purchase.receipts[0]!
    expect(receipt.warehouseId).toBe(a)
    expect(receipt.inventoryMovements).toHaveLength(1)
    const order = await sale(id, 2)
    await expect(act({ action: 'voidReceipt', id: receipt.id, reason: 'Unidades reservadas' })).rejects.toThrow()
    expect((await db.purchaseReceipt.findUniqueOrThrow({ where: { id: receipt.id } })).voidedAt).toBeNull()
    await transition(order.id, 'entregado')
    await expect(act({ action: 'voidReceipt', id: receipt.id, reason: 'Unidades consumidas' })).rejects.toThrow()
    const source = await db.inventoryMovement.findUniqueOrThrow({ where: { originKey: `order:${order.id}:dispatch` } })
    await command({ action: 'return', sourceMovementId: source.id, warehouseId: a, date: today, reason: 'Regreso físico completo', lines: [{ productId: id, quantity: '2' }] })
    await act({ action: 'voidReceipt', id: receipt.id, reason: 'Ya se puede anular' })
    expect((await balance(id)).quantity.toString()).toBe('0')
    expect(await db.inventoryMovement.count({ where: { receiptId: receipt.id, type: 'reversion' } })).toBe(1)
  })
  it('conteos detectan cambios, requieren recontar y solo admin puede aplicarlos', async () => {
    const id = await product()
    await entry(id)
    const created = await command({ action: 'countCreate', warehouseId: a, date: today, reason: 'Conteo físico de prueba' }) as { id: string }
    await command({ action: 'countAdd', id: created.id, version: 1, productId: id })
    const get = () => db.inventoryCount.findUniqueOrThrow({ where: { id: created.id }, include: { lines: true } })
    let c = await get()
    await command({ action: 'countEdit', id: c.id, version: c.version, lines: c.lines.map(l => ({ productId: l.productId, counted: l.productId === id ? '9' : l.expected.toString() })) })
    c = await get()
    await command({ action: 'countSubmit', id: c.id, version: c.version })
    await entry(id, '1')
    c = await get()
    await expect(command({ action: 'countApply', id: c.id, version: c.version })).rejects.toThrow()
    await command({ action: 'countRefresh', id: c.id, version: c.version })
    c = await get()
    expect(c.lines.find(l => l.productId === id)!.counted).toBeNull()
    await command({ action: 'countEdit', id: c.id, version: c.version, lines: [{ productId: id, counted: '9' }] })
    c = await get()
    await command({ action: 'countSubmit', id: c.id, version: c.version })
    c = await get()
    await expect(command({ action: 'countApply', id: c.id, version: c.version }, { ...user, role: 'mostrador' })).rejects.toThrow()
    await command({ action: 'countApply', id: c.id, version: c.version })
    expect((await balance(id)).quantity.toString()).toBe('9')
  })
  it('conteos selectivos agregan y quitan partidas sin ajustar productos no seleccionados', async () => {
    const id = await product(), untouched = await product()
    await entry(id, '3')
    await entry(untouched, '7')
    const created = await command({ action: 'countCreate', warehouseId: a, date: today, reason: 'Conteo selectivo' }) as { id: string, version: number, date: string, lines: unknown[] }
    expect(created.lines).toEqual([])
    expect(created.date).toBe(today)
    await expect(command({ action: 'countSubmit', id: created.id, version: 1 })).rejects.toThrow()
    await expect(command({ action: 'countAdd', id: created.id, version: 1, productId: serviceProduct })).rejects.toThrow()
    const add: InventoryCommand = { requestId: randomUUID(), command: { action: 'countAdd', id: created.id, version: 1, productId: id } }
    const added = await executeInventory(add, user) as { version: number, lines: Array<{ expected: string }> }
    expect(await executeInventory(add, user)).toEqual(added)
    expect(added.lines[0]?.expected).toBe('3')
    expect(added.version).toBe(2)
    await expect(command({ action: 'countAdd', id: created.id, version: 2, productId: id })).rejects.toThrow('incluido')
    await command({ action: 'countAdd', id: created.id, version: 2, productId: untouched })
    await expect(command({ action: 'countRemove', id: created.id, version: 2, productId: untouched })).rejects.toThrow()
    await command({ action: 'countRemove', id: created.id, version: 3, productId: untouched })
    await command({ action: 'countEdit', id: created.id, version: 4, lines: [{ productId: id, counted: '4.000001' }] })
    await command({ action: 'countSubmit', id: created.id, version: 5 })
    await expect(command({ action: 'countAdd', id: created.id, version: 6, productId: untouched })).rejects.toThrow('borrador')
    await expect(command({ action: 'countRemove', id: created.id, version: 6, productId: id })).rejects.toThrow('borrador')
    await command({ action: 'countApply', id: created.id, version: 6 })
    expect((await balance(id)).quantity.toString()).toBe('4.000001')
    expect((await balance(untouched)).quantity.toString()).toBe('7')
  })
  it('guarda todo el catálogo consultado y lo encuentra por páginas sin importar saldos externos', async () => {
    const catalog: SiigoProduct[] = Array.from({ length: 102 }, (_, index) => ({
      id: randomUUID(), code: `CAT-${String(index + 1).padStart(3, '0')}`, name: `Producto de catálogo ${index + 1}`,
      active: true, type: 'Product', unit: { code: 'H87', name: 'Pieza' },
      reference: `REF-${index + 1}`, additional_fields: { barcode: `750${index + 1}` },
      available_quantity: 9999, warehouses: [{ id: 1, quantity: 9999 }]
    }))
    const service = { ...catalog[0]!, id: randomUUID(), code: 'CAT-SERVICE', type: 'Service' }
    const inactive = { ...catalog[0]!, id: randomUUID(), code: 'CAT-INACTIVE', active: false }
    const stockBefore = await balance(initialProduct)
    const configBefore = await db.inventoryProduct.findUniqueOrThrow({ where: { productId: initialProduct } })
    const existing = await db.siigoProduct.findUniqueOrThrow({ where: { id: initialProduct } })
    await persistProductCatalog(db, [...catalog, service, inactive, { id: initialProduct, code: existing.code, name: existing.name, type: 'Product', active: true, available_quantity: 9999 }])
    const query = { page: 1, page_size: 100, search: 'CAT-', controlledOnly: 'true' as const }
    const first = await listInventory('products', query) as { results: Array<{ id: string }>, pagination: { totalResults: number, totalPages: number } }
    const second = await listInventory('products', { ...query, page: 2 }) as { results: Array<{ id: string, reference: string, additional_fields: { barcode: string } }> }
    expect(first.pagination).toMatchObject({ totalResults: 102, totalPages: 2 })
    expect(first.results).toHaveLength(100)
    expect(second.results.map(row => row.id)).toEqual([catalog[100]!.id, catalog[101]!.id])
    expect(second.results[0]).toMatchObject({ reference: 'REF-101', additional_fields: { barcode: '750101' } })
    expect((await balance(catalog[100]!.id)).quantity.toString()).toBe('0')
    expect((await balance(catalog[100]!.id)).reserved.toString()).toBe('0')
    await command({ action: 'tracking', productId: catalog[0]!.id, version: 1, enabled: false })
    const disabledConfig = await db.inventoryProduct.findUniqueOrThrow({ where: { productId: catalog[0]!.id } })
    await persistProductCatalog(db, catalog)
    expect(await db.inventoryProduct.findUniqueOrThrow({ where: { productId: catalog[0]!.id } })).toEqual(disabledConfig)
    expect(await balance(initialProduct)).toEqual(stockBefore)
    expect(await db.inventoryProduct.findUniqueOrThrow({ where: { productId: initialProduct } })).toEqual(configBefore)
    expect(await db.siigoProduct.count({ where: { id: { in: catalog.map(p => p.id) } } })).toBe(102)
  })
  it('consulta filtros, mínimos, permisos y bloquea desactivación de almacenes con saldo', async () => {
    const warehouses = await listInventory('warehouses', { page: 1, page_size: 1, search: '' }) as { results: unknown[], pagination: { totalPages: number } }
    expect(warehouses.results).toHaveLength(1)
    expect(warehouses.pagination.totalPages).toBe(2)
    const id = await product()
    await entry(id, '2')
    const old = await balance(id)
    await command({ action: 'minimum', warehouseId: a, productId: id, minimum: '3', version: old.version })
    const result = await listInventory('stocks', { page: 1, page_size: 100, search: '', productId: id, low: 'true' }) as { results: Array<{ low: boolean }> }
    expect(result.results[0]?.low).toBe(true)
    await expect(command({ action: 'tracking', productId: id, enabled: false, version: 1 })).rejects.toThrow()
    await expect(entry(serviceProduct)).rejects.toThrow()
    const w = await db.inventoryWarehouse.findUniqueOrThrow({ where: { id: a } })
    await expect(command({ action: 'warehouse', id: a, version: w.version, code: w.code, name: w.name, address: '', active: false })).rejects.toThrow()
    await expect(command({ action: 'move', type: 'entrada', warehouseId: a, date: today, reason: 'Sin permiso', lines: [{ productId: id, quantity: '1' }] }, { ...user, role: 'vendedor' })).rejects.toThrow()
  })
  it('el kardex reconstruye existencias y las reservas coinciden; SQL protege historial y acceso directo', async () => {
    const balances = await db.inventoryBalance.findMany()
    for (const row of balances) {
      const sum = await db.inventoryMovementLine.aggregate({ where: { warehouseId: row.warehouseId, productId: row.productId }, _sum: { delta: true } })
      const reservations = await db.inventoryReservation.aggregate({ where: { warehouseId: row.warehouseId, productId: row.productId }, _sum: { quantity: true } })
      expect(new Decimal(sum._sum.delta?.toString() ?? '0').eq(row.quantity.toString())).toBe(true)
      expect(new Decimal(reservations._sum.quantity?.toString() ?? '0').eq(row.reserved.toString())).toBe(true)
    }
    await expect(db.$executeRawUnsafe('UPDATE inventory_movements SET reason = reason')).rejects.toThrow('inmutable')
    for (const role of ['anon', 'authenticated']) {
      await expect(db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`)
        return tx.inventoryBalance.findMany()
      })).rejects.toThrow()
    }
  })
})
