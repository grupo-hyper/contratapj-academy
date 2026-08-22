import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import type { Role } from './auth/authContext'

// ---- Supabase mock (sem rede, sem env) ------------------------------------
// Espelha o mock do AuthProvider.test: controla getSession (usuário) e
// maybeSingle (papel do perfil) pra dirigir o estado de auth por teste.
const mocks = vi.hoisted(() => {
  const unsubscribe = vi.fn()
  return {
    unsubscribe,
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe } },
    })),
    maybeSingle: vi.fn(),
  }
})

vi.mock('./lib/supabase', () => {
  const eq = vi.fn(() => ({ maybeSingle: mocks.maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  return {
    supabase: {
      auth: {
        getSession: mocks.getSession,
        onAuthStateChange: mocks.onAuthStateChange,
        signInWithPassword: vi.fn(),
        signInWithOtp: vi.fn(),
        signOut: vi.fn(),
      },
      from,
    },
  }
})

// Importa DEPOIS do mock registrado.
import { AuthProvider } from './auth/AuthProvider'
import { routes } from './router'

const FAKE_USER = { id: 'user-1', email: 'ana@contratapj.com.br' }

/** Configura o mock para uma sessão autenticada com o papel dado. */
function signedInAs(role: Role) {
  mocks.getSession.mockResolvedValue({ data: { session: { user: FAKE_USER } } })
  mocks.maybeSingle.mockResolvedValue({
    data: { id: 'user-1', nome: 'Ana', role, avatar_url: null },
    error: null,
  })
}

/** Configura o mock para nenhuma sessão. */
function signedOut() {
  mocks.getSession.mockResolvedValue({ data: { session: null } })
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
}

/** Renderiza o app no caminho dado, dentro do AuthProvider. */
function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: mocks.unsubscribe } },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('router + RequireRole', () => {
  it('não autenticado em / é redirecionado pro /login', async () => {
    signedOut()
    renderAt('/')

    expect(
      await screen.findByRole('heading', { name: /contratapj academy/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/início do aluno/i)).not.toBeInTheDocument()
  })

  it('aluno em /gestor é bloqueado (cai na home)', async () => {
    signedInAs('aluno')
    renderAt('/gestor')

    expect(await screen.findByText(/início do aluno/i)).toBeInTheDocument()
    expect(screen.queryByText(/painel do gestor/i)).not.toBeInTheDocument()
  })

  it('aluno em /autor é bloqueado (cai na home)', async () => {
    signedInAs('aluno')
    renderAt('/autor')

    expect(await screen.findByText(/início do aluno/i)).toBeInTheDocument()
    expect(screen.queryByText(/cms do autor/i)).not.toBeInTheDocument()
  })

  it('gestor em /autor é bloqueado (cai na home)', async () => {
    signedInAs('gestor')
    renderAt('/autor')

    expect(await screen.findByText(/início do aluno/i)).toBeInTheDocument()
    expect(screen.queryByText(/cms do autor/i)).not.toBeInTheDocument()
  })

  it('gestor em /gestor é liberado', async () => {
    signedInAs('gestor')
    renderAt('/gestor')

    expect(await screen.findByText(/painel do gestor/i)).toBeInTheDocument()
  })

  it('autor em /autor é liberado', async () => {
    signedInAs('autor')
    renderAt('/autor')

    expect(await screen.findByText(/cms do autor/i)).toBeInTheDocument()
  })

  it('aluno em / é liberado (home)', async () => {
    signedInAs('aluno')
    renderAt('/')

    expect(await screen.findByText(/início do aluno/i)).toBeInTheDocument()
  })

  it('rota desconhecida cai na home', async () => {
    signedInAs('aluno')
    renderAt('/rota-que-nao-existe')

    expect(await screen.findByText(/início do aluno/i)).toBeInTheDocument()
  })
})
