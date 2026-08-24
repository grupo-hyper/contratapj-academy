/**
 * Teste focado no useLesson (Task 3.3), o pedaço mais frágil: a mutation
 * `markConcluded` deve INVALIDAR a query de progresso da Home
 * (`['lesson_progress', userId]`) no sucesso — é isso que faz a trilha do
 * dashboard atualizar. Um refactor da chave quebraria essa ligação silenciosamente
 * se nada a exercitasse.
 *
 * Estratégia: QueryClient REAL (não mockado) + wrapper de QueryClientProvider;
 * mockamos SÓ o `supabase` (upsert resolve ok). Espionamos
 * `queryClient.invalidateQueries` e afirmamos que foi chamado com a chave da Home.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// ---- Mock só do supabase --------------------------------------------------
// `select().eq().eq().maybeSingle()` (aula) e `select().eq().eq().maybeSingle()`
// (progresso) resolvem vazio; `upsert()` resolve sem erro.
const upsertMock = vi.fn().mockResolvedValue({ error: null })
function makeThenable() {
  // Encadeável: cada .eq() devolve o mesmo objeto; .maybeSingle() resolve.
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
  chain.upsert = upsertMock
  return chain
}
vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(() => makeThenable()) },
}))

import { useLesson } from './useLesson'

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('useLesson — invalidação da query de progresso da Home', () => {
  it('markConcluded faz upsert e invalida ["lesson_progress", userId]', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useLesson('l1', 'u1'), {
      wrapper: makeWrapper(queryClient),
    })

    // Dispara a conclusão.
    result.current.markConcluded()

    // O upsert do supabase é chamado com o payload correto.
    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1))
    expect(upsertMock).toHaveBeenCalledWith(
      { profile_id: 'u1', lesson_id: 'l1', pct: 100, concluida: true },
      { onConflict: 'profile_id,lesson_id' },
    )

    // No sucesso, invalida a chave de progresso da HOME (a que a trilha usa).
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['lesson_progress', 'u1'],
      }),
    )
  })
})
