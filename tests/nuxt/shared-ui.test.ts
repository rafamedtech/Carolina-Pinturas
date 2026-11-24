// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { AppButton, DetailCard, DetailFields, DetailHeader, DetailPageHeader, DetailStatCard, ListLoading, StatusBadge, UBadge, UButton } from '#components'

describe('contratos de los componentes compartidos', () => {
  it('renderiza el texto y el icono del estado con el tono y tamaño indicados', async () => {
    const wrapper = await mountSuspended(StatusBadge, {
      props: { label: 'En revisión', color: 'warning', icon: 'i-lucide-clock', size: 'sm' }
    })
    try {
      expect(wrapper.text()).toBe('En revisión')
      expect(wrapper.getComponent(UBadge).props()).toMatchObject({ color: 'warning', size: 'sm', variant: 'subtle' })
      expect(wrapper.get('[data-slot="leadingIcon"]').attributes('aria-hidden')).toBe('true')
    } finally {
      wrapper.unmount()
    }
  })

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

  it.each([
    [undefined, 'primary', 'solid'],
    ['primary', 'primary', 'solid'],
    ['secondary', 'neutral', 'outline'],
    ['danger', 'error', 'soft'],
    ['quiet', 'neutral', 'ghost']
  ] as const)('resuelve la intención %s y prioriza cada opción explícita', async (intent, color, variant) => {
    const wrapper = await mountSuspended(AppButton, { props: { intent, label: 'Guardar' } })
    try {
      const button = wrapper.getComponent(UButton)
      expect(button.props()).toMatchObject({ color, variant })
      await wrapper.setProps({ color: 'success' })
      expect(button.props()).toMatchObject({ color: 'success', variant })
      await wrapper.setProps({ color: undefined, variant: 'link' })
      expect(button.props()).toMatchObject({ color, variant: 'link' })
    } finally {
      wrapper.unmount()
    }
  })

  it('conserva los slots con su contexto y los atributos de envío de formulario', async () => {
    const wrapper = await mountSuspended(AppButton, {
      props: { type: 'submit', size: 'sm', label: 'Etiqueta alternativa' },
      attrs: { 'form': 'expense-form', 'aria-describedby': 'expense-hint' },
      slots: {
        leading: ({ ui }) => h('span', { class: ui.leadingIcon() }, 'Antes'),
        default: () => 'Guardar',
        trailing: ({ ui }) => h('span', { class: ui.trailingIcon() }, 'Después')
      }
    })
    try {
      const button = wrapper.get('button')
      expect(button.attributes()).toMatchObject({
        'type': 'submit',
        'form': 'expense-form',
        'aria-describedby': 'expense-hint'
      })
      expect(button.text()).toBe('AntesGuardarDespués')
      expect(wrapper.getComponent(UButton).props('size')).toBe('sm')
    } finally {
      wrapper.unmount()
    }
  })

  it('conserva el regreso, el refresco y los controles del consumidor', async () => {
    const wrapper = await mountSuspended(DetailHeader, {
      props: {
        title: 'Detalle del producto',
        back: { to: '/productos?tab=inactive', label: 'Volver a productos' },
        refreshLabel: 'Actualizar producto desde Siigo'
      },
      slots: {
        actions: () => h('button', { 'aria-label': 'Cambiar taller' }),
        breadcrumbs: () => h('nav', 'Ruta del producto')
      }
    })
    try {
      expect(wrapper.get('a[aria-label="Volver a productos"]').attributes('href')).toBe('/productos?tab=inactive')
      expect(wrapper.get('nav').text()).toBe('Ruta del producto')
      expect(wrapper.find('button[aria-label="Cambiar taller"]').exists()).toBe(true)

      const refresh = wrapper.get('button[aria-label="Actualizar producto desde Siigo"]')
      expect(refresh.get('[data-slot="label"]').classes()).toEqual(expect.arrayContaining(['hidden', 'sm:inline']))
      await refresh.trigger('click')
      expect(wrapper.emitted('refresh')).toEqual([[]])
      await wrapper.setProps({ loading: true })
      expect(refresh.attributes('disabled')).toBeDefined()
      await wrapper.setProps({ showRefresh: false })
      expect(wrapper.find('button[aria-label="Actualizar producto desde Siigo"]').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('admite acciones móviles y de escritorio que aparecen después de cargar los datos', async () => {
    const ready = shallowRef(false)
    const wrapper = await mountSuspended(defineComponent({
      setup: () => () => h(DetailPageHeader, { title: 'Registro' }, ready.value
        ? {
            description: () => h(AppButton, { 'aria-label': 'Acciones del producto', 'class': 'sm:hidden' }),
            links: () => h(AppButton, { label: 'Editar', to: '/productos' })
          }
        : {})
    }))
    expect(wrapper.find('a').exists()).toBe(false)
    ready.value = true
    await nextTick()
    expect(wrapper.get('a').text()).toBe('Editar')
    expect(wrapper.get('a').attributes('href')).toBe('/productos')
    expect(wrapper.get('[data-slot="links"]').classes()).toEqual(expect.arrayContaining(['hidden', 'sm:flex']))
    expect(wrapper.get('button[aria-label="Acciones del producto"]').classes()).toContain('sm:hidden')
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
