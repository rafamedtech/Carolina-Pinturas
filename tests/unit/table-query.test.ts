import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { EffectScope } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Router } from 'vue-router'
import { parseDate } from '@internationalized/date'
import type { OrderDateRange } from '../../app/types/orders'
import { tableQueryBoolean, tableQueryDate, tableQueryField, tableQueryPage, tableQueryRange, tableQuerySorting, tableQueryText, tableReturnPath } from '../../app/utils/tableQuery'
import { useTableQuery } from '../../app/composables/useTableQuery'

const context = vi.hoisted(() => ({ router: undefined as Router | undefined }))
vi.mock('#app', () => ({
  useRoute: () => context.router!.currentRoute.value,
  useRouter: () => context.router!
}))

let router: Router
let scope: EffectScope
beforeEach(async () => {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/list', component: {} }, { path: '/detail', component: {} }]
  })
  context.router = router
  await router.push('/list')
  scope = effectScope()
})
afterEach(() => scope.stop())

async function settle() {
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 0))
}

function table() {
  const search = ref('')
  const status = ref('all')
  const page = ref(1)
  const range = ref<OrderDateRange | null>(null)
  const state = scope.run(() => useTableQuery([
    tableQueryField('search', search, tableQueryText()),
    tableQueryField('status', status, tableQueryText('all', ['all', 'pending', 'done'])),
    tableQueryRange(range),
    tableQueryField('page', page, tableQueryPage)
  ], { page, resetOn: [search, status, range] }))!
  return { search, status, page, range, ...state }
}

describe('table URL state', () => {
  it('restores search, filters, dates and page before the first request', async () => {
    await router.replace('/list?search=Pintura&status=pending&date_from=2026-09-01&date_to=2026-09-30&page=4')
    const state = table()
    expect(state.search.value).toBe('Pintura')
    expect(state.status.value).toBe('pending')
    expect(state.page.value).toBe(4)
    expect(state.range.value?.start?.toString()).toBe('2026-09-01')
    expect(state.returnTo.value).toContain('page=4')
  })

  it('resets pagination for a changed filter and preserves unrelated URL parameters', async () => {
    await router.replace('/list?page=4&returnTo=%2Fclientes&sort=total:desc#table')
    const state = table()
    state.search.value = 'Pintura azul'
    await settle()
    expect(state.page.value).toBe(1)
    expect(router.currentRoute.value.query).toEqual({ search: 'Pintura azul', returnTo: '/clientes', sort: 'total:desc' })
    expect(router.currentRoute.value.hash).toBe('#table')
    state.page.value = 2
    await settle()
    expect(router.currentRoute.value.query.page).toBe('2')
  })

  it('restores query-only navigation without resetting the restored page', async () => {
    const state = table()
    await router.push('/list?search=Nuevo&status=done&page=3')
    await settle()
    expect(state.search.value).toBe('Nuevo')
    expect(state.status.value).toBe('done')
    expect(state.page.value).toBe(3)
    await router.replace('/list?search=Anterior&page=2')
    await settle()
    expect(state.search.value).toBe('Anterior')
    expect(state.page.value).toBe(2)
  })

  it('merges simultaneous changes from separate controls on the same page', async () => {
    const state = table()
    const grouped = ref(false)
    scope.run(() => useTableQuery([tableQueryField('grouped', grouped, tableQueryBoolean)]))
    state.search.value = 'Proveedor'
    grouped.value = true
    await settle()
    expect(router.currentRoute.value.query).toEqual({ search: 'Proveedor', grouped: 'true' })
  })

  it('clears defaults and retains date-only days', async () => {
    await router.replace('/list?search=Azul&status=done&page=4')
    const state = table()
    state.search.value = ''
    state.status.value = 'all'
    state.range.value = { start: parseDate('2026-10-01'), end: parseDate('2026-10-13') }
    await settle()
    expect(router.currentRoute.value.query).toEqual({ date_from: '2026-10-01', date_to: '2026-10-13' })
    state.range.value = null
    await settle()
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('does not write list parameters into a detail page during navigation', async () => {
    const state = table()
    await router.push('/detail?returnTo=%2Flist')
    state.search.value = 'Late input'
    await settle()
    expect(router.currentRoute.value.path).toBe('/detail')
    expect(router.currentRoute.value.query).toEqual({ returnTo: '/list' })
  })

  it('tolerates invalid and repeated URL parameters', async () => {
    await router.replace('/list?search=one&search=two&status=invalid&page=-3&date_from=2026-02-30&date_to=2026-01-01')
    const state = table()
    expect(state.search.value).toBe('')
    expect(state.status.value).toBe('all')
    expect(state.page.value).toBe(1)
    expect(state.range.value).toBeNull()
    expect(tableQueryDate.parse('2026-02-30')).toBe('')
    expect(tableQueryPage.parse('Infinity')).toBe(1)
    expect(tableQueryPage.parse('1.5')).toBe(1)
  })
})

describe('table return paths and sorting', () => {
  it('preserves sorting and ignores malformed sort entries', () => {
    const sorting = [{ id: 'total', desc: true }, { id: 'date', desc: false }]
    expect(tableQuerySorting.parse(tableQuerySorting.serialize(sorting))).toEqual(sorting)
    expect(tableQuerySorting.parse('invalid,total:desc')).toEqual([sorting[0]])
  })
  it('accepts only the intended collection when returning from a detail', () => {
    expect(tableReturnPath('/productos?search=Azul&page=3', '/productos')).toBe('/productos?search=Azul&page=3')
    expect(tableReturnPath('https://example.com', '/productos')).toBe('/productos')
    expect(tableReturnPath('/productos/otro', '/productos')).toBe('/productos')
    expect(tableReturnPath('/compras/cuentas-por-pagar?grouped=true', '/compras', ['/compras', '/compras/cuentas-por-pagar'])).toContain('grouped=true')
  })
})
