import { defineVitestConfig } from '@nuxt/test-utils/config'

// Los tests unitarios (tests/unit) corren en Node; los de componentes
// (tests/nuxt) declaran `@vitest-environment nuxt` en el propio archivo.
export default defineVitestConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environmentOptions: {
      nuxt: {
        domEnvironment: 'happy-dom'
      }
    }
  }
})
