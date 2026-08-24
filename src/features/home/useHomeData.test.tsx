/**
 * Teste do seam de quiz no useHomeData (Task 4.2): as tentativas de quiz do
 * aluno alimentam `quizPassedByModule`, que entra em `computeUnlockState`.
 * Asserção-chave: um módulo com TODAS as aulas concluídas mas SEM quiz aprovado
 * permanece `current` (não `done`), então o próximo módulo NÃO libera.
 *
 * Estratégia: QueryClient real + wrapper; mockamos SÓ o supabase, roteando por
 * `.from(<tabela>)` para devolver o fixture certo (modules/lessons/
 * lesson_progress/quiz_attempts/questions).
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// Fixtures de tabela, sobrescritos por teste.
let TABLES: Record<string, unknown[]> = {}

// Um "thenable" encadeável por tabela: select()/eq()/order()/in() devolvem o
// mesmo objeto; a resolução (await) entrega { data, error } com as linhas da
// tabela. Suporta o filtro .eq('module_id'/'profile_id') o suficiente para os
// testes (aqui os fixtures já vêm escopados ao usuário).
function makeTableChain(rows: unknown[]) {
  const result = { data: rows, error: null }
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.in = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.then = (resolve: (v: typeof result) => unknown) => resolve(result)
  return chain
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => makeTableChain(TABLES[table] ?? [])),
  },
}))

import { useHomeData } from './useHomeData'

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
  TABLES = {}
})

describe('useHomeData — seam de quiz na trilha', () => {
  // 2 módulos, m1 tem 1 aula concluída e um teste (questions). m2 vem depois.
  function seedBase() {
    TABLES = {
      modules: [
        { id: 'm1', ordem: 1, titulo: 'M1', descricao: null, capa_url: null, publicado: true, created_at: '' },
        { id: 'm2', ordem: 2, titulo: 'M2', descricao: null, capa_url: null, publicado: true, created_at: '' },
      ],
      lessons: [
        { id: 'l1', module_id: 'm1', ordem: 1, titulo: 'A1', texto_md: null, youtube_id: null, duracao_seg: null, publicado: true, created_at: '' },
        { id: 'l2', module_id: 'm2', ordem: 1, titulo: 'A2', texto_md: null, youtube_id: null, duracao_seg: null, publicado: true, created_at: '' },
      ],
      lesson_progress: [
        { id: 'p1', profile_id: 'u1', lesson_id: 'l1', pct: 100, concluida: true, updated_at: '' },
      ],
      questions: [{ module_id: 'm1' }], // m1 TEM teste
      quiz_attempts: [],
    }
  }

  it('aulas de m1 concluídas mas quiz NÃO aprovado => m1 fica current e m2 locked', async () => {
    seedBase()
    const { result } = renderHook(() => useHomeData('u1'), {
      wrapper: makeWrapper(newClient()),
    })

    await waitFor(() => expect(result.current.data).toBeDefined())
    const unlock = result.current.data!.unlockState
    // m1 tem a aula concluída, mas o quiz não passou => NÃO done => current.
    expect(unlock.m1.state).toBe('current')
    // Logo m2 não libera.
    expect(unlock.m2.state).toBe('locked')
  })

  it('com quiz APROVADO em m1 => m1 done e m2 libera (current)', async () => {
    seedBase()
    TABLES.quiz_attempts = [
      { id: 'qa1', profile_id: 'u1', module_id: 'm1', nota: 90, aprovado: true, respostas: {}, created_at: '2026-08-20T12:00:00Z' },
    ]
    const { result } = renderHook(() => useHomeData('u1'), {
      wrapper: makeWrapper(newClient()),
    })

    await waitFor(() => expect(result.current.data).toBeDefined())
    const unlock = result.current.data!.unlockState
    expect(unlock.m1.state).toBe('done')
    expect(unlock.m2.state).toBe('current')
    // Resumo de quiz exposto para a UI.
    expect(result.current.data!.quizByModule.m1).toMatchObject({
      attemptsUsed: 1,
      passed: true,
    })
  })
})
