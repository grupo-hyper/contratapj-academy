/**
 * useClassRoster (G2): resolve matriculados (enrollments ⋈ profiles) e candidatos
 * (alunos fora da turma), e expõe enroll/unenroll. Mock do supabase por tabela.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const enrollData = [
  { id: 'e1', profile_id: 'p1', created_at: '2026-01-01T00:00:00Z' },
]
const profilesData = [
  { id: 'p1', nome: 'Ana' },
  { id: 'p2', nome: 'Bia' },
  { id: 'p3', nome: 'Caio' },
]

const insertMock = vi.fn().mockResolvedValue({ error: null })
const deleteEqMock = vi.fn().mockResolvedValue({ error: null })
const deleteMock = vi.fn(() => ({ eq: deleteEqMock }))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'enrollments') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: enrollData, error: null }),
            }),
          }),
          insert: insertMock,
          delete: deleteMock,
        }
      }
      // profiles
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: profilesData, error: null }),
          }),
        }),
      }
    }),
  },
}))

import { useClassRoster } from './useClassRoster'

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

afterEach(() => vi.clearAllMocks())

describe('useClassRoster (G2)', () => {
  it('separa matriculados (com nome) dos candidatos disponíveis', async () => {
    const { result } = renderHook(() => useClassRoster('c1'), {
      wrapper: makeWrapper(makeQc()),
    })

    await waitFor(() => expect(result.current.enrolled).toHaveLength(1))
    expect(result.current.enrolled[0]).toMatchObject({
      enrollmentId: 'e1',
      profileId: 'p1',
      nome: 'Ana',
    })
    // p2 e p3 não estão na turma → disponíveis; p1 já está → fora da lista.
    expect(result.current.available.map((a) => a.id)).toEqual(['p2', 'p3'])
  })

  it('enroll insere {class_id, profile_id}', async () => {
    const { result } = renderHook(() => useClassRoster('c1'), {
      wrapper: makeWrapper(makeQc()),
    })
    result.current.enroll('p2')
    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1))
    expect(insertMock).toHaveBeenCalledWith({ class_id: 'c1', profile_id: 'p2' })
  })

  it('unenroll faz DELETE pelo id da matrícula', async () => {
    const { result } = renderHook(() => useClassRoster('c1'), {
      wrapper: makeWrapper(makeQc()),
    })
    result.current.unenroll('e1')
    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1))
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'e1')
  })
})
