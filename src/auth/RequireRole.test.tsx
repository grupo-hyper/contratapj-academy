import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { AuthContextValue } from './authContext'

// Mocka o useAuth diretamente pra dirigir o estado sem AuthProvider/Supabase.
const useAuthMock = vi.hoisted(() => vi.fn())
vi.mock('./useAuth', () => ({ useAuth: useAuthMock }))

import { RequireRole } from './RequireRole'

function setAuth(partial: Partial<AuthContextValue>) {
  useAuthMock.mockReturnValue({
    user: null,
    profile: null,
    loading: false,
    signIn: vi.fn(),
    signInWithPassword: vi.fn(),
    signInWithMagicLink: vi.fn(),
    signOut: vi.fn(),
    ...partial,
  })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('RequireRole', () => {
  it('mostra o estado de carregamento enquanto loading=true', () => {
    setAuth({ loading: true })
    render(
      <MemoryRouter>
        <RequireRole>
          <div>conteúdo protegido</div>
        </RequireRole>
      </MemoryRouter>,
    )

    expect(screen.getByText(/carregando/i)).toBeInTheDocument()
    expect(screen.queryByText(/conteúdo protegido/i)).not.toBeInTheDocument()
  })

  it('mostra carregamento quando há usuário mas o perfil ainda não chegou', () => {
    setAuth({ loading: false, user: { id: 'u1' } as never, profile: null })
    render(
      <MemoryRouter>
        <RequireRole allow={['gestor']}>
          <div>conteúdo protegido</div>
        </RequireRole>
      </MemoryRouter>,
    )

    expect(screen.getByText(/carregando/i)).toBeInTheDocument()
    expect(screen.queryByText(/conteúdo protegido/i)).not.toBeInTheDocument()
  })
})
