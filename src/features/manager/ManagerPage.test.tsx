/**
 * ManagerPage (G1): renderiza a composição real (lista de turmas + detalhe) com a
 * camada de dados (useManagerClasses) e o auth mockados. Cobre: selecionar turma,
 * criar, renomear, definir meta e excluir (com confirm).
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UseManagerClassesResult } from './useManagerClasses'

// Auth: gestor logado.
vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'g1', email: 'gestor@contratapj.com.br' },
    profile: { id: 'g1', nome: 'Gil', role: 'gestor', avatar_url: null },
    loading: false,
    signOut: vi.fn(),
  }),
}))

const useManagerClassesMock = vi.fn()
vi.mock('./useManagerClasses', () => ({
  useManagerClasses: (...args: unknown[]) => useManagerClassesMock(...args),
}))

// O detalhe da turma renderiza <ClassRoster>, que usa useClassRoster. Mockamos
// para um roster estável (sem rede) — o comportamento do roster tem teste próprio.
vi.mock('./useClassRoster', () => ({
  useClassRoster: () => ({
    enrolled: [],
    available: [],
    isLoading: false,
    isError: false,
    error: null,
    enroll: () => {},
    unenroll: () => {},
    isMutating: false,
    isMutationError: false,
  }),
}))

import { ManagerPage } from './ManagerPage'

function baseResult(
  overrides: Partial<UseManagerClassesResult> = {},
): UseManagerClassesResult {
  return {
    classes: [
      { id: 'c1', nome: 'Turma A', created_at: '2026-01-01T00:00:00Z', modulesPerWeek: 2 },
      { id: 'c2', nome: 'Turma B', created_at: '2026-02-01T00:00:00Z', modulesPerWeek: null },
    ],
    isLoading: false,
    isError: false,
    error: null,
    createClass: vi.fn(),
    renameClass: vi.fn(),
    deleteClass: vi.fn(),
    setGoal: vi.fn(),
    isMutating: false,
    isMutationError: false,
    ...overrides,
  }
}

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('ManagerPage (G1)', () => {
  it('lista as turmas e mostra o placeholder até selecionar uma', () => {
    useManagerClassesMock.mockReturnValue(baseResult())
    render(<ManagerPage />)

    expect(screen.getByRole('button', { name: /Turma A/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Turma B/i })).toBeInTheDocument()
    expect(screen.getByText(/selecione uma turma/i)).toBeInTheDocument()
  })

  it('selecionar uma turma abre o detalhe com o nome e a meta atual', () => {
    useManagerClassesMock.mockReturnValue(baseResult())
    render(<ManagerPage />)

    fireEvent.click(screen.getByRole('button', { name: /Turma A/i }))
    // Nome no input de renomear + meta atual visível.
    expect(screen.getByLabelText(/nome da turma/i)).toHaveValue('Turma A')
    expect(screen.getByText(/2 módulo\(s\)\/semana/i)).toBeInTheDocument()
  })

  it('criar turma chama createClass com o nome digitado', () => {
    const createClass = vi.fn()
    useManagerClassesMock.mockReturnValue(baseResult({ createClass }))
    render(<ManagerPage />)

    fireEvent.change(screen.getByLabelText(/nome da nova turma/i), {
      target: { value: 'Turma C' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^criar$/i }))
    expect(createClass).toHaveBeenCalledWith('Turma C')
  })

  it('definir a meta chama setGoal com o número parseado', () => {
    const setGoal = vi.fn()
    useManagerClassesMock.mockReturnValue(baseResult({ setGoal }))
    render(<ManagerPage />)

    // Turma B não tem meta.
    fireEvent.click(screen.getByRole('button', { name: /Turma B/i }))
    expect(screen.getByText(/ainda não tem meta/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/módulos por semana/i), {
      target: { value: '1.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: /salvar meta/i }))
    expect(setGoal).toHaveBeenCalledWith('c2', 1.5)
  })

  it('excluir turma pede confirmação e chama deleteClass', () => {
    const deleteClass = vi.fn()
    useManagerClassesMock.mockReturnValue(baseResult({ deleteClass }))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ManagerPage />)

    fireEvent.click(screen.getByRole('button', { name: /Turma A/i }))
    fireEvent.click(screen.getByRole('button', { name: /excluir turma/i }))
    expect(window.confirm).toHaveBeenCalledTimes(1)
    expect(deleteClass).toHaveBeenCalledWith('c1')
  })

  it('cancelar a confirmação NÃO exclui', () => {
    const deleteClass = vi.fn()
    useManagerClassesMock.mockReturnValue(baseResult({ deleteClass }))
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<ManagerPage />)

    fireEvent.click(screen.getByRole('button', { name: /Turma A/i }))
    fireEvent.click(screen.getByRole('button', { name: /excluir turma/i }))
    expect(deleteClass).not.toHaveBeenCalled()
  })
})
