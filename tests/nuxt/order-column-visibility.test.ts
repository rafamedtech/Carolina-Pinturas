// @vitest-environment nuxt
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { VueWrapper } from '@vue/test-utils'
import { useOrderListTable } from '~/composables/useOrderListTable'

const storageKey = 'test:orders:column-visibility'
let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  localStorage.removeItem(storageKey)
  localStorage.removeItem(`${storageKey}:other`)
})

describe('columnas de pedidos por pestaña', () => {
  it('restaura cada pestaña después de remontar y conserva los valores predeterminados de las demás', async () => {
    const tab = ref('all')
    let table!: ReturnType<typeof useOrderListTable>
    const Harness = defineComponent({
      setup() {
        table = useOrderListTable({ returnTo: '/ventas', columnVisibilityKey: storageKey, tab })
        return () => h('div')
      }
    })
    wrapper = await mountSuspended(Harness)
    table.columnVisibility.value = { ...table.columnVisibility.value, rfc: true, customer: false }
    tab.value = 'facturacion'
    await nextTick()
    expect(table.columnVisibility.value).toMatchObject({ rfc: false, createdAt: false })
    expect(table.columnVisibility.value.customer).toBeUndefined()
    table.columnVisibility.value = { ...table.columnVisibility.value, createdAt: true, siigoInvoice: false }
    wrapper.unmount()

    wrapper = await mountSuspended(Harness)
    expect(table.columnVisibility.value).toMatchObject({ rfc: false, createdAt: true, siigoInvoice: false })
    tab.value = 'all'
    await nextTick()
    expect(table.columnVisibility.value).toMatchObject({ rfc: true, customer: false, createdAt: false })
    expect(table.columnVisibility.value.siigoInvoice).toBeUndefined()
  })

  it('separa las preferencias de otros usuarios o tablas y de las tablas sin persistencia', async () => {
    const key = ref(storageKey)
    let table!: ReturnType<typeof useOrderListTable>
    let customerTable!: ReturnType<typeof useOrderListTable>
    wrapper = await mountSuspended(defineComponent({
      setup() {
        table = useOrderListTable({ returnTo: '/ventas', columnVisibilityKey: key })
        customerTable = useOrderListTable({ returnTo: '/clientes' })
        return () => h('div')
      }
    }))
    table.columnVisibility.value = { ...table.columnVisibility.value, rfc: true }
    key.value = `${storageKey}:other`
    await nextTick()
    expect(table.columnVisibility.value.rfc).toBe(false)
    table.columnVisibility.value = { ...table.columnVisibility.value, itemCount: true }
    key.value = storageKey
    await nextTick()
    expect(table.columnVisibility.value).toMatchObject({ rfc: true, itemCount: false })
    expect(customerTable.columnVisibility.value.rfc).toBe(false)
  })
})
