/**
 * useManagerClasses (G1): lê as turmas do gestor com a meta embutida e expõe as
 * mutations de gestão (criar/renomear/excluir turma; definir meta). Mockamos o
 * supabase roteando por tabela e espionamos invalidateQueries.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const classesData = [
  { id: 'c1', nome: 'Turma A', created_at: '2026-01-01T00:00:00Z' },
  { id: 'c2', nome: 'Turma B', created_at: '2026-02-01T00:00:00Z' },
]
const goalsData = [{ class_id: 'c1', modules_per_week: 2 }]

const insertMock = vi.fn().mockResolvedValue({ error: null })
const updateEqMock = vi.fn().mockResolvedValue({ error: null })
const updateMock = vi.fn(() => ({ eq: updateEqMock }))
const deleteEqMock = vi.fn().mockResolvedValue({ error: null })
const deleteMock = vi.fn(() => ({ eq: deleteEqMock }))
const upsertMock = vi.fn().mockResolvedValue({ error: null })

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'classes') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: classesData, error: null }),
            }),
          }),
          insert: insertMock,
          update: updateMock,
          delete: deleteMock,
        }
      }
      // class_goals
      return {
        select: () => Promise.resolve({ data: goalsData, error: null }),
        upsert: upsertMock,
      }
    }),
  },
}))

import { useManagerClasses } from './useManagerClasses'

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

afterEach(() => vi.clearAllMocks())

describe('useManagerClasses (G1)', () => {
  it('devolve as turmas do gestor com a meta de ritmo embutida', async () => {
    const { result } = renderHook(() => useManagerClasses('g1'), {
      wrapper: makeWrapper(makeQc()),
    })

    await waitFor(() => expect(result.current.classes).toHaveLength(2))
    const [a, b] = result.current.classes
    expect(a).toMatchObject({ id: 'c1', nome: 'Turma A', modulesPerWeek: 2 })
    // Turma sem meta cai para null.
    expect(b).toMatchObject({ id: 'c2', nome: 'Turma B', modulesPerWeek: null })
  })

  it('createClass insere {nome, gestor_id} e invalida o painel do aluno também', async () => {
    const qc = makeQc()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useManagerClasses('g1'), {
      wrapper: makeWrapper(qc),
    })

    result.current.createClass('Turma Nova')
    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1))
    expect(insertMock).toHaveBeenCalledWith({
      nome: 'Turma Nova',
      gestor_id: 'g1',
    })
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['class_goals'] }),
    )
  })

  it('renameClass faz UPDATE {nome} pelo id', async () => {
    const { result } = renderHook(() => useManagerClasses('g1'), {
      wrapper: makeWrapper(makeQc()),
    })
    result.current.renameClass('c1', 'Turma A2')
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ nome: 'Turma A2' }))
    expect(updateEqMock).toHaveBeenCalledWith('id', 'c1')
  })

  it('deleteClass faz DELETE pelo id', async () => {
    const { result } = renderHook(() => useManagerClasses('g1'), {
      wrapper: makeWrapper(makeQc()),
    })
    result.current.deleteClass('c2')
    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1))
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'c2')
  })

  it('setGoal faz UPSERT em class_goals com onConflict class_id', async () => {
    const { result } = renderHook(() => useManagerClasses('g1'), {
      wrapper: makeWrapper(makeQc()),
    })
    result.current.setGoal('c1', 1.5)
    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1))
    expect(upsertMock).toHaveBeenCalledWith(
      { class_id: 'c1', modules_per_week: 1.5 },
      { onConflict: 'class_id' },
    )
  })
})
