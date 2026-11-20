import { reportCurrency as sharedReportCurrency } from '@rafamedtech/nuxt-shared/utils'
import { expect, it } from 'vitest'
import { purchaseMoney } from '../../app/utils/purchaseFormat'
import { reportCurrency } from '../../app/utils/reportPeriods'

const amounts = [1234.56, -1234.56, 0]
const mxn = ['$1,234.56', '-$1,234.56', '$0.00']

it('usa el formateador MXN compartido con dos decimales en reportes', () => {
  expect(reportCurrency).toBe(sharedReportCurrency)
  expect(amounts.map(reportCurrency.format)).toEqual(mxn)
})

it('distingue MXN, USD, cero y valores ausentes en compras', () => {
  expect(amounts.map(amount => purchaseMoney(amount, 'MXN'))).toEqual(mxn)
  expect(amounts.map(amount => purchaseMoney(amount, 'USD'))).toEqual([
    'USD\u00a01,234.56', '-USD\u00a01,234.56', 'USD\u00a00.00'
  ])
  expect(purchaseMoney(null, 'MXN')).toBe('—')
  expect(purchaseMoney(undefined, 'USD')).toBe('—')
  expect(purchaseMoney(1234.56, 'JPY')).toBe('JPY\u00a01,234.56')
})
