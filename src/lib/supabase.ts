import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// TODO: generate Database types after migrations (Phase 1+) and pass them as
// the generic to createClient<Database>() for end-to-end type safety.

/**
 * Reads a required Vite env var, throwing a readable error naming the missing
 * variable. Validation is lazy: it runs on first use of the client (via
 * getSupabase() or first property access on `supabase`), never at module
 * import. This keeps importing this module side-effect-free, so trees that
 * import the client can be rendered in tests without stubbing env up front.
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

let _client: SupabaseClient | null = null

/**
 * Returns the singleton Supabase client, creating it (and validating env) on
 * first call. Constructing the client performs no network I/O — requests only
 * happen when a query/auth method is invoked.
 */
export function getSupabase(): SupabaseClient {
  if (_client === null) {
    _client = createClient(requireEnv('VITE_SUPABASE_URL'), requireEnv('VITE_SUPABASE_ANON_KEY'))
  }
  return _client
}

/**
 * Ergonomic named export. A lazy Proxy that initializes the real client on the
 * first property access, so `import { supabase }` does zero work at import time.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabase(), prop, receiver)
  },
})
