// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import ProductForm from '~/components/products/ProductForm.vue'
import ProductEditor from '~/components/products/ProductEditor.vue'
import SatPicker from '~/components/products/SatPicker.vue'
import ProductBrandField from '~/components/products/ProductBrandField.vue'
import { useProductMutation } from '~/composables/useProductMutation'
import type { SiigoProduct } from '~/types/siigo'
import { productMutationInput } from '~/utils/siigoProductMutation'

mockNuxtImport('useAuth', () => () => ({ user: { value: { role: 'admin' } } }))

const id = '00000000-0000-4000-8000-000000000001'
const product: SiigoProduct = {
  id, code: 'PIN1', name: 'Pintura', type: 'Product', active: true,
  unit: { code: 'H87' }, key: { code: '31211500' }, account_group: { id: 10 },
  prices: [{ currency_code: 'MXN', price_list: [{ position: 1, value: 100 }] }, { currency_code: 'USD', price_list: [{ position: 2, value: 6 }] }]
}
const context = {
  accountGroups: [{ id: 10, name: 'Pinturas', active: true }],
  taxes: [{ id: 5, name: 'IVA 8%', active: true }],
  priceLists: [{ id: 1, name: 'Público', active: true }, { id: 2, name: 'Mayoreo', active: true }]
}
registerEndpoint('/api/siigo/products/context', () => context)
registerEndpoint(`/api/siigo/products/${id}`, () => product)
let wrapper: VueWrapper | undefined
registerEndpoint('/api/siigo/products', () => ({ results: [
  { ...product, additional_fields: { brand: 'MAX' } },
  { ...product, additional_fields: { brand: 'max' } },
  { ...product, additional_fields: { brand: 'AXALTA' } }
] }))
registerEndpoint('/api/siigo/products/sat', async () => {
  await new Promise(resolve => setTimeout(resolve, 10))
  return { results: [{ code: 'H87', name: 'Pieza' }], pagination: { page: 1, page_size: 25, total_results: 1 }, retrievedAt: '2026-09-15', source: 'https://example.com' }
})
const baseId = '00000000-0000-4000-8000-000000000002'
registerEndpoint('/api/inventory/products', () => ({ results: [{ id: baseId, code: 'BASE', name: 'Producto base', unit: 'Pieza', enabled: true, version: 1 }], pagination: { totalPages: 1 } }))
afterEach(() => {
  wrapper?.unmount()
})

describe('formulario de productos', () => {
  it('conserva correcciones no enviadas al confirmar el intento y actualiza solo su versión interna', async () => {
    wrapper = await mountSuspended(ProductForm, { props: { product, context, saving: false, blocked: true } })
    await wrapper.get('input[maxlength="100"]').setValue('Corrección todavía no enviada')
    await wrapper.setProps({ product: { ...product, name: 'Nombre confirmado' }, confirmedVersion: 2, blocked: false })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('submit')?.at(-1)?.[0]).toMatchObject({ name: 'Corrección todavía no enviada', composition: { version: 2 } })
  })
  it('carga explícitamente el borrador pendiente para corregirlo', async () => {
    wrapper = await mountSuspended(ProductForm, { props: { product, context, saving: false, blocked: true } })
    const draft = { ...productMutationInput(product), name: 'Datos del intento pendiente', composition: { kind: 'product' as const, version: 3, components: [] } }
    await wrapper.setProps({ draft, blocked: false })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('submit')?.at(-1)?.[0]).toMatchObject({ name: draft.name, composition: { version: 3 } })
  })
  it.each([false, true])('usa H87 y oculta referencia y código de barras al editar o duplicar (duplicar: %s)', async (duplicate) => {
    wrapper = await mountSuspended(ProductForm, { props: {
      product: { ...product, unit: {}, reference: 'Referencia original', additional_fields: { barcode: '123', brand: 'Marca' } },
      duplicate, context, saving: false, blocked: false
    } })
    expect(wrapper.text()).not.toContain('Referencia')
    expect(wrapper.text()).not.toContain('Código de barras')
    expect(wrapper.findAllComponents(SatPicker).find(picker => picker.props('kind') === 'unit')?.props('modelValue')).toBe('H87')
    if (duplicate) await wrapper.get('input[maxlength="30"]').setValue('PIN2')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      unit: 'H87', reference: 'Referencia original', additional_fields: { barcode: duplicate ? '' : '123', brand: 'Marca' }
    })
  })
  it.each(['Compra', 'Venta directa', 'Gasto'])('calcula Activo al encender y apagar %s sin mostrar un switch propio', async (label) => {
    wrapper = await mountSuspended(ProductForm, { props: {
      product: { ...product, active: true, internal: { availability: { purchase: false, sale: false, expense: false } } },
      context, saving: false, blocked: false
    } })
    expect(wrapper.findAllComponents({ name: 'USwitch' }).some(component => component.props('label') === 'Activo')).toBe(false)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('submit')?.at(-1)?.[0]).toMatchObject({ active: false })
    const toggle = wrapper.findAllComponents({ name: 'USwitch' }).find(component => component.props('label') === label)!
    await toggle.get('button').trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('submit')?.at(-1)?.[0]).toMatchObject({ active: true })
    await toggle.get('button').trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('submit')?.at(-1)?.[0]).toMatchObject({ active: false })
  })
  it('busca marcas del catálogo sin duplicar mayúsculas y permite crear una nueva', async () => {
    wrapper = await mountSuspended(ProductBrandField, { props: { modelValue: 'Marca actual' } })
    const menu = wrapper.findComponent({ name: 'USelectMenu' })
    await vi.waitFor(() => expect(menu.props('items')).toEqual(['AXALTA', 'Marca actual', 'MAX']))
    await menu.vm.$emit('update:searchTerm', ' max ')
    await flushPromises()
    expect(menu.props('createItem')).toBe(false)
    await menu.vm.$emit('update:modelValue', 'AXALTA')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['AXALTA'])
    await menu.vm.$emit('update:searchTerm', ' Nueva marca ')
    await flushPromises()
    expect(menu.props('createItem')).toEqual({ when: 'always', position: 'bottom' })
    await menu.vm.$emit('create', ' Nueva marca ')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['Nueva marca'])
    expect(menu.props('items')).toContain('Nueva marca')
    await menu.vm.$emit('update:searchTerm', 'x'.repeat(51))
    await flushPromises()
    expect(menu.props('createItem')).toBe(false)
  })
  it('duplica los datos en un alta que exige código nuevo y conserva el original', async () => {
    const source: SiigoProduct = { ...product, additional_fields: { barcode: '123', brand: 'Marca' }, internal: {
      composition: { kind: 'composite', version: 3, components: [{ productId: baseId, quantity: '0.25' }] },
      availability: { purchase: false, sale: true, expense: false }
    } }
    const original = structuredClone(source)
    wrapper = await mountSuspended(ProductForm, { props: { product: source, duplicate: true, context, saving: false, blocked: false } })
    await flushPromises()
    expect(wrapper.text()).toContain('Crear producto')
    expect(wrapper.text()).not.toContain('Guardar cambios')
    expect((wrapper.get('input[maxlength="30"]').element as HTMLInputElement).value).toBe('')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('submit')).toBeUndefined()
    await wrapper.get('input[maxlength="30"]').setValue('PIN2')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ code: 'PIN2', name: 'Pintura', prices: product.prices,
      additional_fields: { barcode: '', brand: 'Marca' },
      composition: { kind: 'composite', version: 1, components: [{ productId: baseId, quantity: '0.25' }] },
      availability: { purchase: false, sale: true, expense: false }
    })
    expect(source).toEqual(original)
  })
  it('edita y envía una composición fraccionaria sin exponer servicios ni control Siigo', async () => {
    wrapper = await mountSuspended(ProductForm, { props: {
      product: { ...product, internal: { composition: { kind: 'composite', version: 3, components: [{ productId: baseId, quantity: '0.25' }] } } }, context, saving: false, blocked: false
    } })
    await flushPromises()
    expect(wrapper.text()).toContain('Producto compuesto')
    expect(wrapper.text()).toContain('Producto base')
    expect(wrapper.text()).not.toContain('Control de inventario en Siigo')
    await wrapper.get('input[aria-label="Cantidad de Producto base"]').setValue('6')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ type: 'Product', stock_control: false,
      composition: { kind: 'composite', version: 3, components: [{ productId: baseId, quantity: '6' }] }, prices: product.prices })
  })
  it('envía las opciones de disponibilidad independientemente de la composición', async () => {
    wrapper = await mountSuspended(ProductForm, { props: { product, context, saving: false, blocked: false } })
    expect(wrapper.text()).toContain('Disponibilidad del producto')
    await wrapper.findAllComponents({ name: 'USwitch' }).find(component => component.props('label') === 'Venta directa')!.get('button').trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ availability: { purchase: true, sale: false, expense: false } })
  })
  it('muestra campos, conserva monedas y bloquea envío mientras guarda', async () => {
    wrapper = await mountSuspended(ProductForm, { props: { product, context, saving: true, blocked: false } })
    expect(wrapper.text()).toContain('Información general')
    expect(wrapper.text()).toContain('Precios e impuestos')
    expect(wrapper.find('fieldset').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('input').map(input => input.element.value)).toEqual(expect.arrayContaining(['PIN1', 'Pintura', 'MXN', 'USD', '100', '6']))
  })
  it('no envía alta incompleta; muestra errores en español', async () => {
    wrapper = await mountSuspended(ProductForm, { props: { context, saving: false, blocked: false } })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('Escribe el código.')
    expect(wrapper.text()).toContain('Selecciona una clave SAT de ocho dígitos.')
  })
  it('envía edición con los precios originales', async () => {
    wrapper = await mountSuspended(ProductForm, { props: { product, context, saving: false, blocked: false } })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ code: 'PIN1', prices: product.prices })
  })
  it('mantiene la altura del selector SAT mientras carga los resultados', async () => {
    wrapper = await mountSuspended(SatPicker, {
      attachTo: document.body,
      props: { modelValue: '', kind: 'unit', label: 'Unidad SAT' }
    })
    await wrapper.get('button').trigger('click')

    const loading = document.querySelector('[role="status"]')
    expect(loading?.textContent).toContain('Cargando…')
    expect(document.querySelector('.h-96')).not.toBeNull()

    await vi.waitFor(() => expect(document.body.textContent).toContain('H87 · Pieza'))
    expect(document.querySelector('.h-96')).not.toBeNull()
  })
})

describe('guardado cliente sin duplicados', () => {
  it('restaura el formulario y permite editar cuando el servidor confirma que Siigo no cambió', async () => {
    wrapper = await mountSuspended(ProductEditor, { props: { productId: id } })
    await vi.waitFor(() => expect(wrapper!.findComponent(ProductForm).exists()).toBe(true))
    await wrapper.get('input[maxlength="100"]').setValue('Nombre que no se guardará')
    const originalFetch = globalThis.$fetch
    globalThis.$fetch = vi.fn().mockRejectedValue({ statusCode: 502, data: {
      statusMessage: 'No se guardaron los cambios.',
      data: { ambiguous: false, operationId: id, restoredProduct: product }
    } }) as unknown as typeof $fetch
    try {
      wrapper.findComponent(ProductForm).vm.$emit('submit', { ...productMutationInput(product), name: 'Nombre que no se guardará' })
      await flushPromises()
      await vi.waitFor(() => expect((wrapper!.get('input[maxlength="100"]').element as HTMLInputElement).value).toBe(product.name))
      expect(wrapper.findComponent(ProductForm).props('blocked')).toBe(false)
      expect(wrapper.text()).toContain('No se guardaron los cambios. Se conservaron los valores anteriores de Siigo.')
      expect(wrapper.text()).not.toContain('Guardado pendiente · Paso 1')
      expect(wrapper.text()).not.toContain('Guardado confirmado')
    } finally { globalThis.$fetch = originalFetch }
  })

  it('muestra el intento recién fallido y permite acceder al desbloqueo sin recargar', async () => {
    wrapper = await mountSuspended(ProductEditor, { props: { productId: id } })
    await vi.waitFor(() => expect(wrapper!.findComponent(ProductForm).exists()).toBe(true))
    const originalFetch = globalThis.$fetch
    globalThis.$fetch = vi.fn().mockRejectedValue({ statusCode: 502, data: { data: {
      ambiguous: true, operationId: id,
      cause: { message: 'The Products service is currently unavailable. Please try in a few minutes' }
    } } }) as unknown as typeof $fetch
    try {
      wrapper.findComponent(ProductForm).vm.$emit('submit', productMutationInput(product))
      await flushPromises()
      expect(wrapper.text()).toContain('El servicio de productos de Siigo no está disponible.')
      expect(wrapper.text()).toContain('Guardado pendiente · Paso 1: comprobar · Paso 2: resolver')
      expect(wrapper.text()).toContain('Comprobar otra vez')
      expect(wrapper.findComponent(ProductForm).props('blocked')).toBe(true)
    } finally { globalThis.$fetch = originalFetch }
  })
  it('conserva la causa de Siigo después de consultar un intento con diferencias', async () => {
    let mutation!: ReturnType<typeof useProductMutation>
    wrapper = await mountSuspended(defineComponent({ setup() {
      mutation = useProductMutation()
      return () => h('div')
    } }))
    const originalFetch = globalThis.$fetch
    const fetchMock = vi.fn().mockRejectedValueOnce({ statusCode: 502, data: { data: {
      ambiguous: true, operationId: id, cause: { message: 'The Products service is currently unavailable. Please try in a few minutes' }
    } } }).mockRejectedValueOnce({ data: { statusMessage: 'Siigo todavía no refleja los datos enviados.' } })
    globalThis.$fetch = fetchMock as unknown as typeof $fetch
    try {
      await mutation.save(productMutationInput(product), id)
      expect(mutation.operationId.value).toBe(id)
      await mutation.check(id)
      expect(mutation.errorMessage.value).toContain('El servicio de productos de Siigo no está disponible.')
      expect(mutation.errorMessage.value).toContain('Siigo todavía no refleja los datos enviados.')
      expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', body: { operationId: id }, retry: 0 })
    } finally { globalThis.$fetch = originalFetch }
  })

  it('desbloquea sin reemplazar las correcciones capturadas en el formulario', async () => {
    let mutation!: ReturnType<typeof useProductMutation>
    wrapper = await mountSuspended(defineComponent({ setup() {
      mutation = useProductMutation()
      return () => h(ProductForm, { product, context, saving: false, blocked: false })
    } }))
    const name = wrapper.get('input[maxlength="100"]')
    await name.setValue('Nombre corregido sin guardar')
    const originalFetch = globalThis.$fetch
    const fetchMock = vi.fn().mockResolvedValue({ productId: id })
    globalThis.$fetch = fetchMock as unknown as typeof $fetch
    try {
      expect(await mutation.discard(id, id)).toBe(true)
      expect(fetchMock).toHaveBeenCalledWith('/api/siigo/products/discard-write', { method: 'POST', body: { productId: id, operationId: id }, retry: 0 })
      expect((name.element as HTMLInputElement).value).toBe('Nombre corregido sin guardar')
      expect(mutation.checking.value).toBe(false)
    } finally { globalThis.$fetch = originalFetch }
  })
  it('expone la causa de conciliación y mantiene el bloqueo si falla el desbloqueo', async () => {
    let mutation!: ReturnType<typeof useProductMutation>
    wrapper = await mountSuspended(defineComponent({ setup() {
      mutation = useProductMutation()
      return () => h('div')
    } }))
    const originalFetch = globalThis.$fetch
    globalThis.$fetch = vi.fn().mockRejectedValue({ data: { statusMessage: 'Siigo todavía no refleja los datos enviados.' } }) as unknown as typeof $fetch
    try {
      mutation.ambiguous.value = true
      await mutation.check(id, id)
      expect(mutation.errorMessage.value).toBe('Siigo todavía no refleja los datos enviados.')
      expect(await mutation.discard(id, id)).toBe(false)
      expect(mutation.ambiguous.value).toBe(true)
    } finally { globalThis.$fetch = originalFetch }
  })

  it.each([502, 504])('permite un nuevo intento manual tras un fallo %s confirmado antes de escribir', async (statusCode) => {
    let mutation!: ReturnType<typeof useProductMutation>
    wrapper = await mountSuspended(defineComponent({ setup() {
      mutation = useProductMutation()
      return () => h('div')
    } }))
    const originalFetch = globalThis.$fetch
    const fetchMock = vi.fn().mockRejectedValue({
      statusCode, data: { statusMessage: 'No se pudo consultar Siigo.', data: { ambiguous: false } }
    })
    globalThis.$fetch = fetchMock as unknown as typeof $fetch
    try {
      await mutation.save(productMutationInput(product), id)
      expect(mutation.ambiguous.value).toBe(false)
      expect(mutation.errorMessage.value).toBe('No se pudo consultar Siigo.')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      await mutation.save(productMutationInput(product), id)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally { globalThis.$fetch = originalFetch }
  })

  it('envíos simultáneos hacen una sola llamada y no reintentan timeout', async () => {
    let mutation!: ReturnType<typeof useProductMutation>
    wrapper = await mountSuspended(defineComponent({ setup() {
      mutation = useProductMutation()
      return () => h('div')
    } }))
    const originalFetch = globalThis.$fetch
    let reject!: (error: unknown) => void
    const fetchMock = vi.fn((_url: string, _options: unknown) => new Promise((_, fail) => {
      reject = fail
    }))
    globalThis.$fetch = fetchMock as unknown as typeof $fetch
    try {
      const first = mutation.save(productMutationInput(product), id)
      const second = mutation.save(productMutationInput(product), id)
      reject({ statusCode: 504, data: { data: { ambiguous: true } } })
      await Promise.all([first, second])
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'PUT', retry: 0 })
      expect(mutation.ambiguous.value).toBe(true)
      await mutation.save(productMutationInput(product), id)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally { globalThis.$fetch = originalFetch }
  })
})
