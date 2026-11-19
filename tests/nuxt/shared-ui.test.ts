// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { DetailCard, DetailFields, DetailStatCard, ListLoading } from '#components'
import AppButton from '~/components/AppButton.vue'
import DetailPageHeader from '~/components/detail/DetailPageHeader.vue'

describe('contratos de los componentes compartidos', () => {
  it('mantiene un anuncio por ciclo aunque haya otro indicador visual', async () => {
    const loading = shallowRef(false)
    const label = shallowRef('Cargando registros')
    const fixture = defineComponent({
      setup: () => () => h('div', [
        h(ListLoading, { loading: loading.value, label: label.value, class: 'sr-only' }),
        loading.value && h(ListLoading, {
          announce: false,
          label: label.value,
          size: 'sm',
          ui: { root: 'test-root', label: 'test-label', icon: 'test-icon' }
        })
      ])
    })
    const wrapper = await mountSuspended(fixture)
    try {
      const status = wrapper.get('[role="status"]')
      expect(status.text()).toBe('')
      loading.value = true
      await nextTick()
      expect(status.text()).toBe('')
      await vi.waitFor(() => expect(status.text()).toBe('Cargando registros'))
      expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
      const visual = wrapper.get('.test-root')
      expect(visual.attributes('aria-hidden')).toBe('true')
      expect(visual.get('.test-label').text()).toBe('Cargando registros')
      expect(visual.get('.test-icon').classes()).toEqual(expect.arrayContaining(['size-4', 'motion-safe:animate-spin']))

      label.value = 'Cargando otra página'
      await nextTick()
      expect(status.text()).toBe('Cargando registros')
      loading.value = false
      await nextTick()
      expect(status.text()).toBe('')
      expect(wrapper.find('.test-root').exists()).toBe(false)

      loading.value = true
      await vi.waitFor(() => expect(status.text()).toBe('Cargando otra página'))
    } finally {
      wrapper.unmount()
    }
  })

  it('reenvía clics y atributos accesibles y respeta el estado disabled', async () => {
    const onClick = vi.fn()
    const wrapper = await mountSuspended(AppButton, {
      props: { intent: 'secondary', icon: 'i-lucide-copy', onClick },
      attrs: { 'aria-label': 'Duplicar registro' }
    })
    expect(wrapper.attributes('aria-label')).toBe('Duplicar registro')
    await wrapper.trigger('click')
    expect(onClick).toHaveBeenCalledTimes(1)
    await wrapper.setProps({ disabled: true })
    expect(wrapper.attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('admite acciones que aparecen después de cargar los datos', async () => {
    const ready = shallowRef(false)
    const wrapper = await mountSuspended(defineComponent({
      setup: () => () => h(DetailPageHeader, { title: 'Registro' }, ready.value
        ? { links: () => h(AppButton, { label: 'Editar', to: '/productos' }) }
        : {})
    }))
    expect(wrapper.find('a').exists()).toBe(false)
    ready.value = true
    await nextTick()
    expect(wrapper.get('a').text()).toBe('Editar')
    expect(wrapper.get('a').attributes('href')).toBe('/productos')
    wrapper.unmount()
  })

  it('preserva cero y datos vacíos y sustituye los valores mientras carga', async () => {
    const wrapper = await mountSuspended(DetailFields, {
      props: {
        fields: [
          { label: 'Existencias', value: 0 },
          { label: 'Referencia', value: '' },
          { label: 'Nota', fullWidth: true },
          { label: 'Código', value: null }
        ]
      }
    })
    expect(wrapper.element.tagName).toBe('DL')
    expect(wrapper.classes()).toContain('grid-cols-2')
    expect(wrapper.findAll('dd').map(item => item.text())).toEqual(['0', '—', '—', '—'])
    expect(wrapper.get('div.col-span-full dt').text()).toBe('Nota')
    await wrapper.setProps({ columns: 3 })
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['grid-cols-1', 'sm:grid-cols-3']))
    await wrapper.setProps({ loading: true })
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.findAll('dd').map(item => item.text())).toEqual(['', '', '', ''])
    expect(wrapper.findAll('dd [class~="motion-reduce:animate-none"]')).toHaveLength(4)
    wrapper.unmount()
  })

  it('entrega el campo a los slots de etiqueta y valor', async () => {
    const wrapper = await mountSuspended(DetailFields, {
      props: { fields: [{ key: 'stock', label: 'Existencias', value: 0 }] },
      slots: {
        label: ({ field }) => `Campo ${field.key}`,
        value: ({ field }) => `${field.value} pzas`
      }
    })
    expect(wrapper.get('dt').text()).toBe('Campo stock')
    expect(wrapper.get('dd').text()).toBe('0 pzas')
    wrapper.unmount()
  })

  it('mantiene la unidad con un valor personalizado y la oculta durante la carga', async () => {
    const wrapper = await mountSuspended(DetailStatCard, {
      props: { title: 'Existencias', value: 0, unit: 'pzas', valueColor: 'primary' },
      slots: {
        title: () => 'Existencia física',
        value: () => h('strong', 'Sin existencias'),
        default: () => h('p', 'Almacén principal')
      }
    })
    expect(wrapper.text()).toContain('Existencia física')
    expect(wrapper.get('.tabular-nums.text-primary strong').text()).toBe('Sin existencias')
    expect(wrapper.get('.ml-1').text()).toBe('pzas')
    await wrapper.setProps({ loading: true })
    expect(wrapper.find('[class~="motion-reduce:animate-none"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Sin existencias')
    expect(wrapper.text()).not.toContain('pzas')
    expect(wrapper.get('p').text()).toBe('Almacén principal')
    wrapper.unmount()
  })

  it('conserva el cero y muestra el marcador cuando falta el valor', async () => {
    const wrapper = await mountSuspended(DetailStatCard, { props: { title: 'Existencias', value: 0 } })
    expect(wrapper.get('.tabular-nums').text()).toBe('0')
    await wrapper.setProps({ value: undefined })
    expect(wrapper.get('.tabular-nums').text()).toBe('—')
    wrapper.unmount()
  })

  it('conserva los slots de título, contenido y footer sin crear un enlace', async () => {
    const wrapper = await mountSuspended(DetailCard, {
      slots: { title: () => 'Información', default: () => 'Contenido', footer: () => 'Pie' }
    })
    expect(wrapper.text()).toContain('Información')
    expect(wrapper.text()).toContain('Contenido')
    expect(wrapper.text()).toContain('Pie')
    expect(wrapper.find('a').exists()).toBe(false)
    wrapper.unmount()
  })
})
