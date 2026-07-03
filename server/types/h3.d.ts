import type { JwtPayload } from '@supabase/supabase-js'

declare module 'h3' {
  interface H3EventContext {
    supabaseAuth?: {
      resolved: boolean
      claims: JwtPayload | null
    }
  }
}

export {}
