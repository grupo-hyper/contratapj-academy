/**
 * useSaveLesson: UPDATE em `lessons` pelo id e, no sucesso, invalida a árvore do
 * autor E as queries do aluno (para o player/home refletirem publicação/edição).
 * Mockamos o supabase (update().eq() resolve) e espionamos invalidateQueries.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const eqMock = vi.fn().mockResolvedValue({ error: null })
const updateMock = vi.fn(() => ({ eq: eqMock }))
vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ update: updateMock })) },
}))

import { useSaveLesson } from './useSaveLesson'

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

afterEach(() => vi.clearAllMocks())

describe('useSaveLesson', () => {
  it('faz UPDATE pelo id com o patch e invalida árvore + queries do aluno', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useSaveLesson(), {
      wrapper: makeWrapper(qc),
    })

    const patch = { titulo: 'Novo', youtube_id: null, texto_md: 'x', publicado: true }
    result.current.save({ id: 'l1', patch })

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
    expect(updateMock).toHaveBeenCalledWith(patch)
    expect(eqMock).toHaveBeenCalledWith('id', 'l1')

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['author_tree', 'lessons'],
      }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['lessons'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['lesson', 'l1'] })
  })
})
