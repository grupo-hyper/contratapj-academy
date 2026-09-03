/**
 * useAreas: lê as áreas visíveis, ordenadas por `ordem`. Mockamos o supabase
 * roteando por tabela, no mesmo padrão de `useManagerClasses.test.tsx`.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const areasData = [
  {
    id: 'a1',
    nome: 'Comercial',
    slug: 'comercial',
    descricao: 'Playbooks do time Comercial.',
    capa_url: null,
    visibilidade: 'publica' as const,
    ordem: 1,
    publicado: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'a2',
    nome: 'CS',
    slug: 'cs',
    descricao: null,
    capa_url: null,
    visibilidade: 'publica' as const,
    ordem: 2,
    publicado: true,
    created_at: '2026-01-02T00:00:00Z',
  },
]

const orderMock = vi.fn().mockResolvedValue({ data: areasData, error: null })
const selectMock = vi.fn(() => ({ order: orderMock }))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn((_table: string) => ({
      select: selectMock,
    })),
  },
}))

import { useAreas } from './useAreas'

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

afterEach(() => vi.clearAllMocks())

describe('useAreas', () => {
  it('devolve as áreas ordenadas por `ordem`', async () => {
    const { result } = renderHook(() => useAreas(), {
      wrapper: makeWrapper(makeQc()),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isError).toBe(false)
    expect(result.current.areas).toHaveLength(2)
    expect(result.current.areas.map((a) => a.slug)).toEqual(['comercial', 'cs'])
    expect(orderMock).toHaveBeenCalledWith('ordem', { ascending: true })
  })

  it('degrada para [] quando a tabela areas ainda não existe (PGRST205)', async () => {
    orderMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST205', message: 'relation "public.areas" does not exist' },
    })

    const { result } = renderHook(() => useAreas(), {
      wrapper: makeWrapper(makeQc()),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isError).toBe(false)
    expect(result.current.areas).toEqual([])
  })
})
