/**
 * useAreaAdmin (Task 8): CRUD de áreas pelo admin. Mockamos o supabase roteando
 * por tabela e espionamos invalidateQueries para confirmar que ['areas'] (a
 * mesma chave de useAreas) é invalidada após cada mutation.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const insertMock = vi.fn().mockResolvedValue({ error: null })
const updateEqMock = vi.fn().mockResolvedValue({ error: null })
const updateMock = vi.fn(() => ({ eq: updateEqMock }))
const deleteEqMock = vi.fn().mockResolvedValue({ error: null })
const deleteMock = vi.fn(() => ({ eq: deleteEqMock }))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn((_table: string) => ({
      insert: insertMock,
      update: updateMock,
      delete: deleteMock,
    })),
  },
}))

import { useAreaAdmin } from './useAreaAdmin'

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

afterEach(() => vi.clearAllMocks())

describe('useAreaAdmin (Task 8)', () => {
  it('createArea insere o input exato e invalida ["areas"]', async () => {
    const qc = makeQc()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useAreaAdmin(), {
      wrapper: makeWrapper(qc),
    })

    const input = {
      nome: 'Vendas',
      slug: 'vendas',
      descricao: 'Área de vendas',
      capa_url: null,
      visibilidade: 'publica' as const,
      ordem: 1,
      publicado: true,
    }
    result.current.createArea(input)

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1))
    expect(insertMock).toHaveBeenCalledWith(input)
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['areas'] }),
    )
  })

  it('updateArea(id, patch) faz UPDATE(patch).eq("id", id) e invalida ["areas"]', async () => {
    const qc = makeQc()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useAreaAdmin(), {
      wrapper: makeWrapper(qc),
    })

    const patch = { nome: 'Vendas 2', publicado: false }
    result.current.updateArea('a1', patch)

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith(patch))
    expect(updateEqMock).toHaveBeenCalledWith('id', 'a1')
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['areas'] }),
    )
  })

  it('deleteArea(id) faz DELETE().eq("id", id) e invalida ["areas"]', async () => {
    const qc = makeQc()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useAreaAdmin(), {
      wrapper: makeWrapper(qc),
    })

    result.current.deleteArea('a1')

    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1))
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'a1')
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['areas'] }),
    )
  })

  it('isMutating/isMutationError refletem o estado agregado das 3 mutations', async () => {
    const qc = makeQc()
    const { result } = renderHook(() => useAreaAdmin(), {
      wrapper: makeWrapper(qc),
    })

    expect(result.current.isMutating).toBe(false)
    expect(result.current.isMutationError).toBe(false)

    result.current.deleteArea('a1')
    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.isMutating).toBe(false))
    expect(result.current.isMutationError).toBe(false)
  })
})
