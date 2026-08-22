import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The client is now side-effect-free on import: env validation + createClient
// run lazily on first use (getSupabase() / first property access on `supabase`).
// We stub dummy (non-real) values and re-import fresh per test. No network call
// is ever made — creating a client and building a query are pure operations.

describe('supabase client', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('imports without side effects (no createClient/validation at import)', async () => {
    // Even with a required var missing, merely importing must not throw.
    vi.stubEnv('VITE_SUPABASE_URL', '')
    await expect(import('./supabase')).resolves.toBeDefined()
  })

  it('initializes a usable client on first use with dummy env (no network)', async () => {
    const { supabase, getSupabase } = await import('./supabase')

    // Lazy Proxy forwards to the real client on first property access.
    expect(supabase.auth).toBeDefined()
    expect(typeof supabase.from).toBe('function')
    // from() builds a query lazily; it must not throw / hit the network here.
    expect(supabase.from('any_table')).toBeDefined()

    // getSupabase() returns the same singleton instance.
    expect(getSupabase()).toBe(getSupabase())
  })

  it('throws a readable error naming the missing var on first use', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    const { getSupabase } = await import('./supabase')

    // Import succeeded (side-effect-free); the throw happens on first use.
    expect(() => getSupabase()).toThrow(/VITE_SUPABASE_URL/)
  })
})
