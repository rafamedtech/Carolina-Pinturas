import { createBrowserClient } from '@supabase/ssr'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const url = config.public.supabaseUrl
  const publishableKey = config.public.supabasePublishableKey

  if (!url || !publishableKey) {
    throw new Error('Falta configurar NUXT_PUBLIC_SUPABASE_URL y NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.')
  }

  if (publishableKey.startsWith('sb_secret_')) {
    throw new Error('NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no puede contener una llave secreta.')
  }

  const supabase = createBrowserClient(url, publishableKey)

  return {
    provide: {
      supabase
    }
  }
})
