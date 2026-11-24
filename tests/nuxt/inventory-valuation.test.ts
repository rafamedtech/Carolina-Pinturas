// @vitest-environment nuxt
import { expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { calculateInventoryValuation } from '@rafamedtech/nuxt-shared/utils'
import InventoryValuation from '~/components/inventory/InventoryValuation.vue'

it('muestra los importes de P33 y distingue costos pendientes de almacenes sin existencias', async () => {
  const valuation = calculateInventoryValuation([
    { id: 'empty', code: '10', name: 'Almacén vacío' },
    { id: 'mixed', code: '2', name: 'Almacén con importes' },
    { id: 'pending', code: '3', name: 'Almacén por valorar' }
  ], [
    { warehouseId: 'mixed', productId: 'mxn', quantity: 3, unitCost: '10.25', costCurrency: 'MXN' },
    { warehouseId: 'mixed', productId: 'usd', quantity: 2, unitCost: 12, costCurrency: 'USD' },
    { warehouseId: 'mixed', productId: 'unpriced', quantity: 1, unitCost: null, costCurrency: 'MXN' },
    { warehouseId: 'pending', productId: 'unpriced', quantity: 2, unitCost: 5, costCurrency: null }
  ])

  const wrapper = await mountSuspended(InventoryValuation, { props: { valuation } })
  try {
    const metrics = wrapper.findAll('.tabular-nums').slice(0, 3).map(metric => metric.text())
    expect(metrics).toEqual(['$30.75', 'USD\u00a024.00', '1'])
    expect(wrapper.text()).toContain('El valor registrado es parcial')

    const rows = wrapper.findAll('tbody tr')
    expect(rows.map(row => row.get('td').text())).toEqual([
      'Almacén con importes Almacén 2', 'Almacén por valorar Almacén 3', 'Almacén vacío Almacén 10'
    ])
    expect(rows[0]!.text()).toContain('$30.75 MXN')
    expect(rows[0]!.text()).toContain('24.00 USD')
    expect(rows[0]!.text()).toContain('1 sin costo')
    expect(rows[1]!.text()).toContain('Pendiente de costo')
    expect(rows[1]!.text()).toContain('1 sin costo')
    expect(rows[2]!.text()).toContain('Sin importe')
    expect(rows[2]!.get('td:last-child').text()).toBe('0')

    const cards = wrapper.get('.md\\:hidden')
    expect(cards.text()).toContain('Valor · MXN')
    expect(cards.text()).toContain('Valor · USD')
    expect(cards.text()).toContain('Pendiente de costo')
    expect(cards.text()).toContain('Sin importe')
  } finally {
    wrapper.unmount()
  }
})

it('muestra la valoración vacía sin activar el aviso parcial', async () => {
  const wrapper = await mountSuspended(InventoryValuation, {
    props: { valuation: calculateInventoryValuation([], []) }
  })
  try {
    expect(wrapper.text()).toContain('Sin importe')
    expect(wrapper.get('.md\\:hidden').text()).toContain('Sin almacenes registrados')
    expect(wrapper.get('table').text()).toContain('Sin almacenes registrados')
    expect(wrapper.text()).not.toContain('El valor registrado es parcial')
  } finally {
    wrapper.unmount()
  }
})
