import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import contract from '../contracts/cvr-carolina.json'

// CVRTRANSPORT lee esta base (solo SELECT) para el reporte consolidado de todos los negocios.
// tests/contracts/cvr-carolina.json es una copia exacta de CVRTRANSPORT/shared/carolina-contract.json.
// Si este test falla, la migración rompe el reporte de CVR: coordina el cambio en ambos repos.

type Contract = typeof contract
type Relation = { fkColumn: string, references: string }
type Table = { columns: Set<string>, relations: Relation[] }

export function parsePrismaTables(schema: string) {
  const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)]
  const modelTable = new Map(models.map(([, name, body]) => [name!, body!.match(/@@map\("([^"]+)"\)/)?.[1] ?? name!]))
  const tables = new Map<string, Table>()
  for (const [, name, body] of models) {
    const fieldColumn = new Map<string, string>()
    const columns = new Set<string>()
    const relationLines: Array<{ type: string, fields: string }> = []
    for (const raw of body!.split('\n')) {
      const line = raw.trim()
      if (!line || line.startsWith('//') || line.startsWith('@@')) continue
      const [field, type] = line.split(/\s+/)
      const baseType = type!.replace(/[[\]?]/g, '')
      if (modelTable.has(baseType)) {
        const fields = line.match(/@relation\([^)]*fields:\s*\[([^\]]+)\]/)?.[1]
        if (fields) relationLines.push({ type: baseType, fields })
        continue
      }
      const column = line.match(/@map\("([^"]+)"\)/)?.[1] ?? field!
      fieldColumn.set(field!, column)
      columns.add(column)
    }
    const relations = relationLines
      .filter(item => !item.fields.includes(','))
      .map(item => ({ fkColumn: fieldColumn.get(item.fields.trim()) ?? item.fields.trim(), references: modelTable.get(item.type)! }))
    tables.set(modelTable.get(name!)!, { columns, relations })
  }
  return tables
}

export function contractViolations(schema: string, expected: Contract) {
  const tables = parsePrismaTables(schema)
  const errors: string[] = []
  for (const [table, columns] of Object.entries(expected.tables)) {
    const current = tables.get(table)
    if (!current) {
      errors.push(`falta la tabla ${table}`)
      continue
    }
    for (const column of columns) {
      if (!current.columns.has(column)) errors.push(`falta la columna ${table}.${column}`)
    }
  }
  for (const relation of expected.relations) {
    const found = tables.get(relation.table)?.relations
      .some(item => item.fkColumn === relation.column && item.references === relation.references)
    if (!found) errors.push(`falta la relación ${relation.table}.${relation.column} → ${relation.references}`)
  }
  return errors
}

const schema = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8')

describe('contrato de lectura de CVRTRANSPORT', () => {
  it('el esquema conserva las tablas, columnas y relaciones que lee CVR', () => {
    expect(contractViolations(schema, contract)).toEqual([])
  })

  it('detecta columnas renombradas, tablas eliminadas y relaciones perdidas', () => {
    const broken = schema
      .replace('@map("order_date")', '@map("fecha_pedido")')
      .replace('@@map("inventory_warehouses")', '@@map("almacenes")')
      .replace(/(model SalesOrderItem \{[\s\S]*?)product\s+SiigoProduct\s+@relation\(fields: \[productId\][^\n]*\n/, '$1')
    expect(contractViolations(broken, contract)).toEqual(expect.arrayContaining([
      'falta la columna sales_orders.order_date',
      'falta la tabla inventory_warehouses',
      'falta la relación sales_order_items.product_id → siigo_products'
    ]))
  })
})
