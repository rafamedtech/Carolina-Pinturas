import { describe, expect, it } from 'vitest'
import { createPurchaseSupplierPdf } from '../../app/utils/purchaseSupplierPdf'

describe('PDF de compra para proveedor', () => {
  it('incluye productos y cantidades sin exportar datos financieros ni notas internas', async () => {
    const order = {
      folio: 42, date: '2026-11-05', status: 'confirmada', providerName: 'Proveedor de prueba', providerRfc: 'AAA010101AAA',
      total: 98765.43, notes: 'Nota interna confidencial',
      items: [{ code: 'P-001', name: 'Pintura blanca', quantity: 12, unitCost: 98765.43, total: 98765.43 }]
    }
    const pdf = await createPurchaseSupplierPdf(order)
    const document = pdf.output()
    for (const value of ['OC-42', '05/11/2026', order.providerName, order.providerRfc, 'P-001', 'Pintura blanca', '(12)']) {
      expect(document).toContain(value)
    }
    for (const value of ['98765', 'Costo', 'Importe', 'Subtotal', 'IVA', 'Total', order.notes]) {
      expect(document).not.toContain(value)
    }
  })

  it('pagina listas largas y repite el encabezado de productos', async () => {
    const pdf = await createPurchaseSupplierPdf({
      folio: 43, date: '2026-11-05', status: 'borrador', providerName: 'Proveedor', providerRfc: null,
      items: Array.from({ length: 100 }, (_, index) => ({ code: `COD-${index}`, name: `Producto ${index}`, quantity: index + 1 }))
    })
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1)
    const document = pdf.output()
    expect(document).toContain('COD-99')
    expect(document.match(/\(Producto\)/g)).toHaveLength(pdf.getNumberOfPages())
  })
})
