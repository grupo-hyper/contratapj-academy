import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

// ---- Supabase mock (no network, no env) -----------------------------------
// A shared, resettable set of spies so each test can assert on them and tweak
// return values. maybeSingle() resolves to a fake profile by default.
const mocks = vi.hoisted(() => {
  const unsubscribe = vi.fn()
  // O AuthProvider passou a usar onAuthStateChange como ÚNICA fonte da sessão
  // (sem getSession). O mock captura o callback e emite a sessão inicial
  // (INITIAL_SESSION) de forma assíncrona, como o supabase-js real faz.
  const state: { initialSession?: unknown } = { initialSession: null }
  const onAuthStateChange = vi.fn(
    (cb: (event: string, session: unknown) => void) => {
      queueMicrotask(() => cb('INITIAL_SESSION', state.initialSession ?? null))
      return { data: { subscription: { unsubscribe } } }
    },
  )
  return {
    unsubscribe,
    state,
    getSession: vi.fn(),
    onAuthStateChange,
    signInWithPassword: vi.fn(),
    signInWithOtp: vi.fn(),
    signOut: vi.fn(),
    maybeSingle: vi.fn(),
  }
})

vi.mock('../lib/supabase', () => {
  const eq = vi.fn(() => ({ maybeSingle: mocks.maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  return {
    supabase: {
      auth: {
        getSession: mocks.getSession,
        onAuthStateChange: mocks.onAuthStateChange,
        signInWithPassword: mocks.signInWithPassword,
        signInWithOtp: mocks.signInWithOtp,
        signOut: mocks.signOut,
      },
      from,
    },
  }
})

// Import AFTER the mock is registered.
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

const FAKE_USER = { id: 'user-1', email: 'ana@contratapj.com.br' }
const FAKE_PROFILE = {
  id: 'user-1',
  nome: 'Ana Vendedora',
  role: 'aluno' as const,
  avatar_url: null,
}

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: no session (o onAuthStateChange capturado emite INITIAL_SESSION
  // com esta sessão; getSession não é mais usado pelo AuthProvider).
  mocks.state.initialSession = null
  mocks.getSession.mockResolvedValue({ data: { session: null } })
  mocks.maybeSingle.mockResolvedValue({ data: FAKE_PROFILE, error: null })
  mocks.signInWithPassword.mockResolvedValue({ data: {}, error: null })
  mocks.signInWithOtp.mockResolvedValue({ data: {}, error: null })
  mocks.signOut.mockResolvedValue({ error: null })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useAuth', () => {
  it('throws if used outside AuthProvider', () => {
    // Silence the expected React error boundary console noise.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/)
    spy.mockRestore()
  })

  it('resolves loading=false and exposes user + fetched profile from a session', async () => {
    mocks.state.initialSession = { user: FAKE_USER }

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toEqual(FAKE_USER)
    expect(result.current.profile).toEqual(FAKE_PROFILE)
    expect(result.current.profile?.role).toBe('aluno')
  })

  it('signOut calls supabase.auth.signOut and clears user/profile', async () => {
    mocks.state.initialSession = { user: FAKE_USER }

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toEqual(FAKE_USER)

    await result.current.signOut()

    expect(mocks.signOut).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(result.current.user).toBeNull())
    expect(result.current.profile).toBeNull()
  })

  it('subscribes and unsubscribes from auth state changes', async () => {
    const { unmount, result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mocks.onAuthStateChange).toHaveBeenCalled()
    unmount()
    expect(mocks.unsubscribe).toHaveBeenCalled()
  })
})

// Re-import LoginPage after the mock is set up.
import { LoginPage } from '../features/auth/LoginPage'

describe('LoginPage', () => {
  it('renders the dark-identity login and signs in with password', async () => {
    render(<LoginPage />, { wrapper })

    expect(
      screen.getByRole('heading', { name: /contratapj academy/i }),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: 'ana@contratapj.com.br' },
    })
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'segredo123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^entrar$/i }))

    await waitFor(() =>
      expect(mocks.signInWithPassword).toHaveBeenCalledWith({
        email: 'ana@contratapj.com.br',
        password: 'segredo123',
      }),
    )
  })

  it('toggles to magic link, sends OTP and shows the confirmation state', async () => {
    render(<LoginPage />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: /link mágico/i }))
    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: 'ana@contratapj.com.br' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /receber link de acesso/i }),
    )

    await waitFor(() =>
      expect(mocks.signInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'ana@contratapj.com.br' }),
      ),
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      /enviamos um link de acesso/i,
    )
  })
})
