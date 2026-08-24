/**
 * Teste do useCertificates (Task 4.4):
 *  - resolve certificados do aluno + mapa module_id → titulo.
 *  - degrada para [] quando `certificates` devolve PGRST205.
 *
 * Estratégia: QueryClient real + wrapper; mockamos SÓ o supabase. Como o hook
 * consulta duas tabelas (certificates/modules), o mock roteia por nome da tabela.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

type QueryResult = { data: unknown; error: unknown }
const certResult: { value: QueryResult } = { value: { data: [], error: null } }
const modResult: { value: QueryResult } = { value: { data: [], error: null } }

// `from('certificates')`: select().eq().order() → resolve certResult.
// `from('modules')`:      select().order()      → resolve modResult.
function makeChain(result: { value: unknown }) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.order = vi.fn().mockImplementation(() => Promise.resolve(result.value))
  return chain
}
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) =>
      table === 'certificates' ? makeChain(certResult) : makeChain(modResult),
    ),
  },
}))

import { useCertificates } from './useCertificates'

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
  certResult.value = { data: [], error: null }
  modResult.value = { data: [], error: null }
})

describe('useCertificates', () => {
  it('retorna os certificados e resolve o mapa module_id → titulo', async () => {
    certResult.value = {
      data: [
        {
          id: 'c1',
          profile_id: 'u1',
          tipo: 'modulo',
          module_id: 'm1',
          nota: 90,
          codigo_verificacao: 'ABC',
          created_at: '2026-08-01T00:00:00Z',
        },
      ],
      error: null,
    }
    modResult.value = {
      data: [{ id: 'm1', titulo: 'Prospecção', ordem: 1 }],
      error: null,
    }

    const { result } = renderHook(() => useCertificates('u1'), {
      wrapper: makeWrapper(newClient()),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.certificates).toHaveLength(1)
    expect(result.current.certificates[0].codigo_verificacao).toBe('ABC')
    expect(result.current.moduleTitleById['m1']).toBe('Prospecção')
    expect(result.current.moduleOrderById['m1']).toBe(1)
  })

  it('degrada para [] quando certificates devolve PGRST205', async () => {
    certResult.value = {
      data: null,
      error: { code: 'PGRST205', message: 'não existe' },
    }
    modResult.value = { data: [], error: null }
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useCertificates('u1'), {
      wrapper: makeWrapper(newClient()),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.certificates).toEqual([])
    expect(result.current.isError).toBe(false)
    errSpy.mockRestore()
  })

  it('fica desabilitado (isLoading) sem profileId', () => {
    const { result } = renderHook(() => useCertificates(undefined), {
      wrapper: makeWrapper(newClient()),
    })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.certificates).toEqual([])
  })
})
