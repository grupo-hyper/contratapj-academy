/**
 * Teste de aceite da GoalsPage (Task 5.2): renderiza o painel de ritmo (status
 * atrasado/em dia), o estado "sem meta" e o branch de erro.
 *
 * Estratégia: mockamos a CAMADA DE DADOS (`useGoals`) e o `useAuth`, renderizando
 * a COMPOSIÇÃO real — mesma tática de CertificatesPage.test. Sem rede/Supabase.
 */
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { GoalsModel } from './useGoals'

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'ana@contratapj.com.br' },
    profile: { id: 'user-1', nome: 'Ana', role: 'aluno', avatar_url: null },
    loading: false,
    signOut: vi.fn(),
  }),
}))

const useGoalsMock = vi.fn()
vi.mock('./useGoals', () => ({
  useGoals: (...a: unknown[]) => useGoalsMock(...a),
}))

import { GoalsPage } from './GoalsPage'

const emptyModel: GoalsModel = {
  hasGoal: false,
  className: null,
  modulesPerWeek: null,
  enrolledAtISO: null,
  totalModules: 0,
  completedModules: 0,
  computation: null,
}

function setHook(overrides: {
  model?: Partial<GoalsModel>
  isLoading?: boolean
  isError?: boolean
} = {}) {
  useGoalsMock.mockReturnValue({
    model: { ...emptyModel, ...overrides.model },
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    error: null,
  })
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/metas']}>
      <GoalsPage />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('GoalsPage', () => {
  it('mostra "sem meta" quando o aluno não tem meta de ritmo', () => {
    setHook({ model: { hasGoal: false, className: null } })
    renderPage()
    expect(
      screen.getByText(/nenhuma meta de ritmo definida ainda/i),
    ).toBeInTheDocument()
  })

  it('mostra o painel ATRASADO com módulos faltando', () => {
    setHook({
      model: {
        hasGoal: true,
        className: 'Turma Agosto',
        modulesPerWeek: 1,
        enrolledAtISO: '2026-08-01T00:00:00Z',
        totalModules: 12,
        completedModules: 2,
        computation: {
          weeksElapsed: 4,
          expectedModules: 4,
          completedModules: 2,
          status: 'atrasado',
          modulesBehind: 2,
        },
      },
    })
    renderPage()
    expect(screen.getByText('Atrasado')).toBeInTheDocument()
    expect(screen.getByText(/turma agosto/i)).toBeInTheDocument()
    // A frase de atraso cita quantos módulos faltam.
    expect(screen.getByText(/faltam/i)).toBeInTheDocument()
  })

  it('mostra o painel EM DIA', () => {
    setHook({
      model: {
        hasGoal: true,
        className: 'Turma Agosto',
        modulesPerWeek: 1,
        enrolledAtISO: '2026-08-01T00:00:00Z',
        totalModules: 12,
        completedModules: 4,
        computation: {
          weeksElapsed: 4,
          expectedModules: 4,
          completedModules: 4,
          status: 'em_dia',
          modulesBehind: 0,
        },
      },
    })
    renderPage()
    expect(screen.getByText('Em dia')).toBeInTheDocument()
  })

  it('renderiza o branch de erro quando o hook falha', () => {
    setHook({ isError: true })
    renderPage()
    expect(
      screen.getByText(/não foi possível carregar suas metas/i),
    ).toBeInTheDocument()
  })
})
