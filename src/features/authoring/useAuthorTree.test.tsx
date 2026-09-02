/**
 * useAuthorTree: lê TODOS os módulos e aulas (inclusive rascunhos, que a RLS do
 * autor libera) e agrupa aulas por módulo. Mockamos só o supabase; QueryClient real.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const modules = [
  { id: 'm1', ordem: 1, titulo: 'Mod 1', descricao: null, capa_url: null, publicado: true, created_at: 't' },
  { id: 'm2', ordem: 2, titulo: 'Mod 2', descricao: null, capa_url: null, publicado: false, created_at: 't' },
]
const lessons = [
  { id: 'l1', module_id: 'm1', ordem: 1, titulo: 'Aula A', texto_md: null, youtube_id: null, duracao_seg: null, publicado: true, created_at: 't' },
  { id: 'l2', module_id: 'm1', ordem: 2, titulo: 'Aula B', texto_md: null, youtube_id: null, duracao_seg: null, publicado: false, created_at: 't' },
  { id: 'l3', module_id: 'm2', ordem: 1, titulo: 'Aula C', texto_md: null, youtube_id: null, duracao_seg: null, publicado: false, created_at: 't' },
]

// Encadeável que resolve conforme a tabela pedida em `.from(table)`.
function makeChain(table: string) {
  const rows = table === 'modules' ? modules : lessons
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  // A cadeia é "thenável": o await final resolve os dados.
  chain.then = (resolve: (v: unknown) => void) =>
    resolve({ data: rows, error: null })
  return chain
}
vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn((table: string) => makeChain(table)) },
}))

import { useAuthorTree } from './useAuthorTree'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

afterEach(() => vi.clearAllMocks())

describe('useAuthorTree', () => {
  it('devolve módulos ordenados e aulas agrupadas por módulo (com rascunhos)', async () => {
    const { result } = renderHook(() => useAuthorTree(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.modules.map((m) => m.id)).toEqual(['m1', 'm2'])
    expect(result.current.lessonsByModule['m1'].map((l) => l.id)).toEqual(['l1', 'l2'])
    expect(result.current.lessonsByModule['m2'].map((l) => l.id)).toEqual(['l3'])
    // Rascunho presente (não filtrou por publicado).
    expect(result.current.modules.some((m) => !m.publicado)).toBe(true)
  })
})
