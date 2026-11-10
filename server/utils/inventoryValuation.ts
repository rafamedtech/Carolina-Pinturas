import Decimal from 'decimal.js'
import type { InventoryValuation } from '#shared/types/inventory'
import { usePrisma } from './prisma'

function valuationTotals(totals: Map<string, Decimal>) {
  return [...totals].sort(([a], [b]) => a.localeCompare(b))
    .map(([currencyCode, amount]) => ({ currencyCode, amount: amount.toNumber() }))
}

export async function getInventoryValuation(): Promise<InventoryValuation> {
  const prisma = usePrisma()
  const warehouses = await prisma.inventoryWarehouse.findMany({
    orderBy: [{ name: 'asc' }, { code: 'asc' }],
    select: {
      id: true,
      code: true,
      name: true,
      balances: {
        where: { quantity: { gt: 0 } },
        select: { productId: true, quantity: true, product: { select: { unitCost: true, costCurrency: true } } }
      }
    }
  })

  const inventoryTotals = new Map<string, Decimal>()
  const productsWithoutCost = new Set<string>()
  const warehouseValuations = warehouses.map(({ id, code, name, balances }) => {
    const totals = new Map<string, Decimal>()
    let missingCosts = 0
    for (const { productId, quantity, product } of balances) {
      const { unitCost, costCurrency } = product
      if (unitCost === null || !costCurrency) {
        productsWithoutCost.add(productId)
        missingCosts++
        continue
      }
      const value = new Decimal(quantity.toString()).times(unitCost.toString())
      totals.set(costCurrency, (totals.get(costCurrency) ?? new Decimal(0)).plus(value))
    }
    for (const [currencyCode, amount] of totals) {
      inventoryTotals.set(currencyCode, (inventoryTotals.get(currencyCode) ?? new Decimal(0)).plus(amount))
    }
    return { id, code, name, totals: valuationTotals(totals), productsWithoutCost: missingCosts }
  })

  return {
    totals: valuationTotals(inventoryTotals),
    productsWithoutCost: productsWithoutCost.size,
    warehouses: warehouseValuations
  }
}
