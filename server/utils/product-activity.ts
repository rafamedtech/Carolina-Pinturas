import Decimal from 'decimal.js'
import { mexicoToday } from '#shared/utils/datetime'
import type { ProductActivityPage, ProductActivityRow, ProductActivitySection } from '#shared/types/product-activity'
import { ADMIN_ONLY_EXPENSE_CATEGORIES } from '~/utils/expense'
import { purchaseStatus } from '~/utils/purchaseFormat'
import { orderNumber } from './orders'
import { usePrisma } from './prisma'
import { purchaseBalance, purchaseOrderStatus } from './purchase-domain'

const pageSize = 10

function calendarDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function sum<T>(rows: T[], value: (row: T) => { toString: () => string }) {
  return rows.reduce((total, row) => total.plus(value(row).toString()), new Decimal(0)).toString()
}

export async function listProductActivity(productId: string, section: ProductActivitySection, page: number, admin: boolean) {
  const db = usePrisma()
  const window = { skip: (page - 1) * pageSize, take: pageSize }
  const product = { productId }
  const items = { some: product }

  function result(results: ProductActivityRow[], totalResults: number): ProductActivityPage {
    return { results, pagination: { page, pageSize, totalResults, totalPages: Math.ceil(totalResults / pageSize) } }
  }

  switch (section) {
    case 'sales': {
      const where = { items }
      const [rows, total] = await Promise.all([
        db.salesOrder.findMany({
          where, ...window, orderBy: [{ orderDate: 'desc' }, { folio: 'desc' }],
          select: {
            id: true, folio: true, orderDate: true, customerNameSnapshot: true, currencyCode: true,
            status: { select: { key: true, label: true } },
            siigoInvoice: { select: { siigoInvoiceName: true, siigoInvoiceId: true } },
            items: { where: product, select: { quantity: true, total: true } }
          }
        }),
        db.salesOrder.count({ where })
      ])
      return result(rows.map(row => ({
        id: row.id, date: calendarDate(row.orderDate), reference: orderNumber(row.folio), href: `/ventas/${row.id}`,
        context: row.customerNameSnapshot, status: row.status.key === 'borrador' ? 'Cotización' : row.status.label,
        detail: row.siigoInvoice?.siigoInvoiceId ? row.siigoInvoice.siigoInvoiceName || 'Factura vinculada' : undefined,
        quantity: sum(row.items, item => item.quantity),
        amount: { value: sum(row.items, item => item.total), currency: row.currencyCode }
      })), total)
    }
    case 'purchases': {
      const where = { items }
      const [rows, total] = await Promise.all([
        db.purchaseOrder.findMany({
          where, ...window, orderBy: [{ date: 'desc' }, { folio: 'desc' }],
          select: {
            id: true, folio: true, date: true, providerName: true, status: true, currencyCode: true,
            invoices: {
              where: { voidedAt: null },
              select: { amount: true, dueDate: true, payments: { where: { voidedAt: null }, select: { amount: true, voidedAt: true } } }
            },
            items: { where: product, select: { quantity: true, total: true } }
          }
        }),
        db.purchaseOrder.count({ where })
      ])
      const today = mexicoToday()
      return result(rows.map(row => ({
        id: row.id, date: calendarDate(row.date), reference: `OC-${row.folio}`, href: `/compras/${row.id}`,
        context: row.providerName,
        status: purchaseStatus(purchaseOrderStatus(row.status, row.invoices.map(invoice => ({
          balance: purchaseBalance(invoice.amount.toString(), invoice.payments).toNumber(),
          dueDate: calendarDate(invoice.dueDate),
          voidedAt: null
        })), today)).label,
        quantity: sum(row.items, item => item.quantity),
        amount: { value: sum(row.items, item => item.total), currency: row.currencyCode }
      })), total)
    }
    case 'receipts': {
      const receiptItems = { item: product }
      const where = { items: { some: receiptItems } }
      const [rows, total] = await Promise.all([
        db.purchaseReceipt.findMany({
          where, ...window, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true, date: true, voidedAt: true,
            order: { select: { id: true, folio: true, providerName: true } },
            warehouse: { select: { name: true } },
            items: { where: receiptItems, select: { quantity: true } }
          }
        }),
        db.purchaseReceipt.count({ where })
      ])
      return result(rows.map(row => ({
        id: row.id, date: calendarDate(row.date), reference: `OC-${row.order.folio}`, href: `/compras/${row.order.id}`,
        context: row.order.providerName, detail: row.warehouse?.name,
        status: row.voidedAt ? 'Anulada' : 'Recibida', quantity: sum(row.items, item => item.quantity)
      })), total)
    }
    case 'movements': {
      const where = { lines: { some: product } }
      const [rows, total] = await Promise.all([
        db.inventoryMovement.findMany({
          where, ...window, orderBy: [{ date: 'desc' }, { folio: 'desc' }],
          select: {
            id: true, folio: true, date: true, type: true, reason: true, orderId: true,
            ...(admin ? { receipt: { select: { orderId: true } } } : {}),
            reversal: { select: { id: true } },
            lines: { where: product, orderBy: { warehouseName: 'asc' }, select: {
              id: true, warehouseName: true, delta: true, balanceAfter: true
            } }
          }
        }),
        db.inventoryMovement.count({ where })
      ])
      return result(rows.flatMap(row => row.lines.map(line => ({
        id: line.id, date: calendarDate(row.date), reference: `INV-${row.folio}`,
        href: row.orderId ? `/ventas/${row.orderId}` : admin && row.receipt ? `/compras/${row.receipt.orderId}` : undefined,
        context: line.warehouseName, detail: row.reason,
        status: row.reversal ? `${row.type} · Revertido` : row.type,
        quantity: line.delta.isPositive() && !line.delta.isZero() ? `+${line.delta}` : line.delta.toString(),
        balance: line.balanceAfter.toString()
      }))), total)
    }
    case 'reservations': {
      const [rows, total] = await Promise.all([
        db.inventoryReservation.findMany({
          where: product, ...window, orderBy: [{ order: { orderDate: 'desc' } }, { order: { folio: 'desc' } }],
          select: {
            orderId: true, quantity: true, warehouse: { select: { name: true } },
            order: { select: { folio: true, orderDate: true, customerNameSnapshot: true } }
          }
        }),
        db.inventoryReservation.count({ where: product })
      ])
      return result(rows.map(row => ({
        id: row.orderId, date: calendarDate(row.order.orderDate), reference: orderNumber(row.order.folio), href: `/ventas/${row.orderId}`,
        context: row.warehouse.name, detail: row.order.customerNameSnapshot, status: 'Activa', quantity: row.quantity.toString()
      })), total)
    }
    case 'counts': {
      const [rows, total] = await Promise.all([
        db.inventoryCountLine.findMany({
          where: product, ...window, orderBy: [{ count: { date: 'desc' } }, { countId: 'desc' }],
          select: {
            countId: true, counted: true, expected: true,
            count: { select: { date: true, reason: true, status: true, warehouse: { select: { name: true } }, movement: { select: { folio: true } } } }
          }
        }),
        db.inventoryCountLine.count({ where: product })
      ])
      return result(rows.map(row => ({
        id: row.countId, date: calendarDate(row.count.date),
        reference: row.count.movement ? `INV-${row.count.movement.folio}` : 'Conteo',
        context: row.count.warehouse.name, detail: row.count.reason, status: row.count.status,
        quantity: row.counted?.toString(), balance: row.expected.toString()
      })), total)
    }
    case 'expenses': {
      const where = { ...product, ...(!admin ? { purchasePaymentId: null, category: { notIn: [...ADMIN_ONLY_EXPENSE_CATEGORIES] } } : {}) }
      const [rows, total] = await Promise.all([
        db.expense.findMany({
          where, ...window, orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true, expenseDate: true, category: true, description: true, providerNameSnapshot: true, currencyCode: true, amount: true
          }
        }),
        db.expense.count({ where })
      ])
      return result(rows.map(row => ({
        id: row.id, date: calendarDate(row.expenseDate), reference: row.category,
        context: row.providerNameSnapshot, detail: row.description,
        amount: { value: row.amount.toString(), currency: row.currencyCode }
      })), total)
    }
  }
}
