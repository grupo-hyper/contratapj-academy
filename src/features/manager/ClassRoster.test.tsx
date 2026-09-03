/**
 * ClassRoster (G2): lista matriculados (com remover) e candidatos com busca (com
 * matricular). Mockamos a camada de dados (useClassRoster).
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UseClassRosterResult } from './useClassRoster'

const useClassRosterMock = vi.fn()
vi.mock('./useClassRoster', () => ({
  useClassRoster: (...args: unknown[]) => useClassRosterMock(...args),
}))

import { ClassRoster } from './ClassRoster'

function baseResult(
  overrides: Partial<UseClassRosterResult> = {},
): UseClassRosterResult {
  return {
    enrolled: [
      {
        enrollmentId: 'e1',
        profileId: 'p1',
        nome: 'Ana',
        enrolledAtISO: '2026-01-01T00:00:00Z',
      },
    ],
    available: [
      { id: 'p2', nome: 'Bia' },
      { id: 'p3', nome: 'Caio' },
    ],
    isLoading: false,
    isError: false,
    error: null,
    enroll: vi.fn(),
    unenroll: vi.fn(),
    isMutating: false,
    isMutationError: false,
    ...overrides,
  }
}

afterEach(() => vi.clearAllMocks())

describe('ClassRoster (G2)', () => {
  it('mostra os matriculados e remover chama unenroll com o id da matrícula', () => {
    const unenroll = vi.fn()
    useClassRosterMock.mockReturnValue(baseResult({ unenroll }))
    render(<ClassRoster classId="c1" />)

    expect(screen.getByText('Ana')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /remover/i }))
    expect(unenroll).toHaveBeenCalledWith('e1')
  })

  it('matricular chama enroll com o profileId do candidato', () => {
    const enroll = vi.fn()
    useClassRosterMock.mockReturnValue(baseResult({ enroll }))
    render(<ClassRoster classId="c1" />)

    const matricular = screen.getAllByRole('button', { name: /matricular/i })
    expect(matricular).toHaveLength(2) // Bia e Caio
    fireEvent.click(matricular[0]) // Bia (p2)
    expect(enroll).toHaveBeenCalledWith('p2')
  })

  it('a busca filtra os candidatos pelo nome', () => {
    useClassRosterMock.mockReturnValue(baseResult())
    render(<ClassRoster classId="c1" />)

    fireEvent.change(screen.getByLabelText(/buscar aluno/i), {
      target: { value: 'cai' },
    })
    expect(screen.getByText('Caio')).toBeInTheDocument()
    expect(screen.queryByText('Bia')).not.toBeInTheDocument()
  })

  it('sem candidatos disponíveis, avisa que todos já estão na turma', () => {
    useClassRosterMock.mockReturnValue(baseResult({ available: [] }))
    render(<ClassRoster classId="c1" />)

    expect(
      screen.getByText(/todos os alunos já estão nesta turma/i),
    ).toBeInTheDocument()
  })
})
