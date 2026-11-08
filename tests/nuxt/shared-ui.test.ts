// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import AppButton from '~/components/AppButton.vue'
import DetailCard from '~/components/detail/DetailCard.vue'
import DetailFields from '~/components/detail/DetailFields.vue'
import DetailPageHeader from '~/components/detail/DetailPageHeader.vue'

describe('contratos de los componentes compartidos', () => {
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
      props: { fields: [{ label: 'Existencias', value: 0 }, { label: 'Referencia', value: '' }] }
    })
    expect(wrapper.findAll('dd').map(item => item.text())).toEqual(['0', '—'])
    await wrapper.setProps({ loading: true })
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.findAll('dd').map(item => item.text())).toEqual(['', ''])
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
