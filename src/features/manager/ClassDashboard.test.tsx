/**
 * ClassDashboard (G3): renderiza a tabela de ritmo por aluno, derivando o status
 * com computeGoalStatus (relógio injetado). Mockamos a camada de dados.
 */
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UseClassDashboardResult } from './useClassDashboard'

const useClassDashboardMock = vi.fn()
vi.mock('./useClassDashboard', () => ({
  useClassDashboard: (...args: unknown[]) => useClassDashboardMock(...args),
}))

import { ClassDashboard } from './ClassDashboard'

// now = matrícula + 2 semanas; com ritmo 1/sem o esperado é 2 módulos.
const NOW = new Date('2026-01-15T00:00:00Z')
const ENROLLED = '2026-01-01T00:00:00Z'

function baseResult(
  overrides: Partial<UseClassDashboardResult> = {},
): UseClassDashboardResult {
  return {
    rows: [
      { profileId: 'p1', nome: 'Ana', enrolledAtISO: ENROLLED, completedModules: 0 },
      { profileId: 'p2', nome: 'Bia', enrolledAtISO: ENROLLED, completedModules: 2 },
      { profileId: 'p3', nome: 'Caio', enrolledAtISO: ENROLLED, completedModules: 3 },
    ],
    totalModules: 10,
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  }
}

afterEach(() => vi.clearAllMocks())

describe('ClassDashboard (G3)', () => {
  it('sem meta de ritmo, orienta a definir uma (não renderiza tabela)', () => {
    useClassDashboardMock.mockReturnValue(baseResult())
    render(<ClassDashboard classId="c1" modulesPerWeek={null} now={NOW} />)

    expect(screen.getByText(/defina uma meta de ritmo/i)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('classifica cada aluno vs. o esperado (atrasado/em dia/adiantado)', () => {
    useClassDashboardMock.mockReturnValue(baseResult())
    render(<ClassDashboard classId="c1" modulesPerWeek={1} now={NOW} />)

    // Esperado = 1/sem × 2 semanas = 2 módulos.
    // Ana 0<2 → atrasado; Bia 2 (==esperado) → em dia; Caio 3 (≥ esperado+1) → adiantado.
    expect(screen.getByText('Ana').closest('tr')).toHaveTextContent(/atrasado/i)
    expect(screen.getByText('Bia').closest('tr')).toHaveTextContent(/em dia/i)
    expect(screen.getByText('Caio').closest('tr')).toHaveTextContent(/adiantado/i)
  })

  it('sem alunos matriculados, informa que não há quem acompanhar', () => {
    useClassDashboardMock.mockReturnValue(baseResult({ rows: [] }))
    render(<ClassDashboard classId="c1" modulesPerWeek={1} now={NOW} />)

    expect(screen.getByText(/nenhum aluno matriculado/i)).toBeInTheDocument()
  })
})
