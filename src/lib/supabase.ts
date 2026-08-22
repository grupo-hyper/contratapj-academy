import { createClient } from '@supabase/supabase-js'

// TODO: generate Database types after migrations (Phase 1+) and pass them as
// the generic to createClient<Database>() for end-to-end type safety.

/**
 * Reads a required Vite env var, throwing a readable error naming the missing
 * variable. Throwing here (rather than at module import) keeps a misconfigured
 * deploy from failing silently, while allowing tests to inject dummy values.
 */
function requireEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const value = import.meta.env[name]
  if (!value) {
    throw new Error(
      `[supabase] Variável de ambiente ausente: ${name}. ` +
        'Defina-a no seu .env (veja .env.example).',
    )
  }
  return value
}

const supabaseUrl = requireEnv('VITE_SUPABASE_URL')
const supabaseAnonKey = requireEnv('VITE_SUPABASE_ANON_KEY')

/**
 * Singleton Supabase client for the app. Constructing the client does not
 * perform any network I/O — requests only happen when a query/auth method is
 * called.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
