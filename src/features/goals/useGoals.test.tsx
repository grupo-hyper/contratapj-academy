/**
 * Testes do useGoals (Task 5.2):
 *  - computeGoalStatus (núcleo PURO): atrasado / em dia / adiantado, cap no total,
 *    matrícula no futuro (weeksElapsed nunca negativo).
 *  - useGoals (integração com supabase mockado): resolve o modelo de ritmo,
 *    escolhe a matrícula COM meta, e degrada para "sem meta" / vazio.
 *
 * Estratégia igual à de useCertificates: QueryClient real + wrapper; mockamos SÓ
 * o supabase, roteando por nome da tabela. `now` é injetado para o cálculo ser
 * determinístico.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

type QueryResult = { data: unknown; error: unknown; count?: number }
const enrollRes: { value: QueryResult } = { value: { data: [], error: null } }
const classRes: { value: QueryResult } = { value: { data: [], error: null } }
const goalRes: { value: QueryResult } = { value: { data: [], error: null } }
const quizRes: { value: QueryResult } = { value: { data: [], error: null } }
const modCountRes: { value: QueryResult } = {
  value: { data: null, error: null, count: 12 },
}

// Chain thenable: select()/eq()/order() encadeiam e resolvem no result. `head`
// (contagem) resolve no mesmo objeto (que carrega `count`).
function makeChain(result: { value: QueryResult }) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.then = (resolve: (v: QueryResult) => unknown) =>
    resolve(result.value)
  return chain
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      switch (table) {
        case 'enrollments':
          return makeChain(enrollRes)
        case 'classes':
          return makeChain(classRes)
        case 'class_goals':
          return makeChain(goalRes)
        case 'quiz_attempts':
          return makeChain(quizRes)
        case 'modules':
          return makeChain(modCountRes)
        default:
          return makeChain({ value: { data: [], error: null } })
      }
    }),
  },
}))

import { useGoals, computeGoalStatus } from './useGoals'

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

afterEach(() => {
  vi.clearAllMocks()
  enrollRes.value = { data: [], error: null }
  classRes.value = { data: [], error: null }
  goalRes.value = { data: [], error: null }
  quizRes.value = { data: [], error: null }
  modCountRes.value = { data: null, error: null, count: 12 }
})

describe('computeGoalStatus', () => {
  const enrolledAtISO = '2026-08-01T00:00:00Z'
  // 4 semanas depois da matrícula.
  const now = new Date('2026-08-29T00:00:00Z')

  it('marca ATRASADO quando concluiu menos que o esperado', () => {
    // ritmo 1/sem × 4 sem = 4 esperados; concluiu 2 => atrasado, faltam 2.
    const c = computeGoalStatus({
      modulesPerWeek: 1,
      enrolledAtISO,
      completedModules: 2,
      totalModules: 12,
      now,
    })
    expect(c.status).toBe('atrasado')
    expect(c.expectedModules).toBeCloseTo(4, 5)
    expect(c.modulesBehind).toBe(2)
  })

  it('marca EM DIA quando alcançou o esperado (sem 1 módulo de folga)', () => {
    const c = computeGoalStatus({
      modulesPerWeek: 1,
      enrolledAtISO,
      completedModules: 4,
      totalModules: 12,
      now,
    })
    expect(c.status).toBe('em_dia')
    expect(c.modulesBehind).toBe(0)
  })

  it('marca ADIANTADO quando concluiu ≥1 módulo inteiro a mais', () => {
    const c = computeGoalStatus({
      modulesPerWeek: 1,
      enrolledAtISO,
      completedModules: 5,
      totalModules: 12,
      now,
    })
    expect(c.status).toBe('adiantado')
  })

  it('capa o esperado no total de módulos publicados', () => {
    // ritmo altíssimo, mas só há 3 módulos: esperado nunca passa de 3.
    const c = computeGoalStatus({
      modulesPerWeek: 10,
      enrolledAtISO,
      completedModules: 3,
      totalModules: 3,
      now,
    })
    expect(c.expectedModules).toBe(3)
    expect(c.status).toBe('em_dia')
  })

  it('não gera semanas negativas quando a matrícula está no futuro', () => {
    const c = computeGoalStatus({
      modulesPerWeek: 1,
      enrolledAtISO: '2026-09-01T00:00:00Z',
      completedModules: 0,
      totalModules: 12,
      now,
    })
    expect(c.weeksElapsed).toBe(0)
    expect(c.expectedModules).toBe(0)
    expect(c.status).toBe('em_dia')
  })
})

describe('useGoals', () => {
  const now = new Date('2026-08-29T00:00:00Z') // 4 semanas após 2026-08-01

  it('resolve o modelo de ritmo da turma com meta', async () => {
    enrollRes.value = {
      data: [{ id: 'e1', class_id: 'k1', created_at: '2026-08-01T00:00:00Z' }],
      error: null,
    }
    classRes.value = { data: [{ id: 'k1', nome: 'Turma Agosto' }], error: null }
    goalRes.value = {
      data: [{ class_id: 'k1', modules_per_week: 1 }],
      error: null,
    }
    quizRes.value = {
      data: [
        { module_id: 'm1', aprovado: true },
        { module_id: 'm1', aprovado: true }, // duplicado: conta 1
        { module_id: 'm2', aprovado: true },
        { module_id: 'm3', aprovado: false }, // reprovado: não conta
      ],
      error: null,
    }
    modCountRes.value = { data: null, error: null, count: 12 }

    const { result } = renderHook(() => useGoals('u1', now), {
      wrapper: makeWrapper(newClient()),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const m = result.current.model
    expect(m.hasGoal).toBe(true)
    expect(m.className).toBe('Turma Agosto')
    expect(m.modulesPerWeek).toBe(1)
    expect(m.completedModules).toBe(2) // m1, m2 distintos
    expect(m.totalModules).toBe(12)
    expect(m.computation?.status).toBe('atrasado') // 2 < 4 esperados
    expect(m.computation?.modulesBehind).toBe(2)
  })

  it('matriculado sem meta na turma → hasGoal=false', async () => {
    enrollRes.value = {
      data: [{ id: 'e1', class_id: 'k1', created_at: '2026-08-01T00:00:00Z' }],
      error: null,
    }
    classRes.value = { data: [{ id: 'k1', nome: 'Turma Sem Meta' }], error: null }
    goalRes.value = { data: [], error: null } // sem meta
    quizRes.value = { data: [], error: null }

    const { result } = renderHook(() => useGoals('u1', now), {
      wrapper: makeWrapper(newClient()),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.model.hasGoal).toBe(false)
    expect(result.current.model.className).toBe('Turma Sem Meta')
    expect(result.current.model.computation).toBeNull()
  })

  it('sem matrícula → modelo vazio (hasGoal=false, sem turma)', async () => {
    const { result } = renderHook(() => useGoals('u1', now), {
      wrapper: makeWrapper(newClient()),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.model.hasGoal).toBe(false)
    expect(result.current.model.className).toBeNull()
  })

  it('degrada para vazio quando enrollments devolve PGRST205', async () => {
    enrollRes.value = {
      data: null,
      error: { code: 'PGRST205', message: 'não existe' },
    }
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useGoals('u1', now), {
      wrapper: makeWrapper(newClient()),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.model.hasGoal).toBe(false)
    expect(result.current.isError).toBe(false)
    errSpy.mockRestore()
  })

  it('fica desabilitado (isLoading) sem profileId', () => {
    const { result } = renderHook(() => useGoals(undefined, now), {
      wrapper: makeWrapper(newClient()),
    })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.model.hasGoal).toBe(false)
  })
})
