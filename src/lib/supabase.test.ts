import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The module validates env at import time, so we stub dummy (non-real) values
// and re-import it fresh in each test. No network call is ever made: creating a
// Supabase client is a pure construction step.

describe('supabase client', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('initializes a usable client without real env (mocked, no network)', async () => {
    const { supabase } = await import('./supabase')

    expect(supabase).toBeDefined()
    // Expected client surface used by later phases (auth + data access).
    expect(supabase.auth).toBeDefined()
    expect(typeof supabase.from).toBe('function')
    // from() builds a query lazily; it must not throw / hit the network here.
    expect(supabase.from('any_table')).toBeDefined()
  })

  it('throws a readable error naming the missing var when env is absent', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')

    await expect(import('./supabase')).rejects.toThrow(/VITE_SUPABASE_URL/)
  })
})
