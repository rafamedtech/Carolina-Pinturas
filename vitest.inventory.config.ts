import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const require = createRequire(import.meta.url)
export default defineConfig({
  resolve: { alias: { '~': fileURLToPath(new URL('./app', import.meta.url)), '#shared': fileURLToPath(new URL('./shared', import.meta.url)), 'h3': require.resolve('h3', { paths: [require.resolve('nuxt/package.json')] }) } },
  test: { include: ['tests/integration/inventory.integration.ts'], hookTimeout: 60000, testTimeout: 30000, server: { deps: { external: ['pg', 'pg-pool', '@prisma/adapter-pg'] } } }
})
