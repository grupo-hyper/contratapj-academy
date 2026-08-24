/**
 * Testes do useQuiz (Task 4.2). Focos frágeis:
 *  - useSubmitQuiz INVALIDA a query de tentativas da Home
 *    (`['quiz_attempts', profileId]`) no sucesso — é isso que faz a trilha
 *    atualizar quando o aluno é aprovado. Um refactor da chave quebraria a
 *    ligação silenciosamente.
 *  - Erros da RPC viram uma QuizRejection TIPADA ramificada por `.code`
 *    (SQLSTATE), com o cooldown parseando o instante de `.details` (NUNCA a
 *    mensagem PT-BR).
 *
 * Estratégia: QueryClient REAL + wrapper; mockamos SÓ o supabase.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const rpcMock = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}))

import { useSubmitQuiz } from './useQuiz'

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

describe('useSubmitQuiz', () => {
  it('no sucesso: chama a RPC e invalida ["quiz_attempts", profileId]', async () => {
    rpcMock.mockResolvedValue({
      data: {
        nota: 90,
        aprovado: true,
        acertos: 9,
        total: 10,
        tentativa: 1,
        tentativas_restantes: 2,
        proxima_liberacao: null,
      },
      error: null,
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useSubmitQuiz('m1', 'u1'), {
      wrapper: makeWrapper(queryClient),
    })

    result.current.submit({ q1: 'o1' })

    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1))
    expect(rpcMock).toHaveBeenCalledWith('submit_quiz', {
      p_module_id: 'm1',
      p_answers: { q1: 'o1' },
    })

    await waitFor(() => expect(result.current.result?.aprovado).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['quiz_attempts', 'u1'],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['quiz_attempts_one', 'u1', 'm1'],
    })
    // Aprovar emite um certificado no servidor => a lista de certificados
    // (chave usada por useCertificates) também deve ser invalidada.
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['certificates', 'u1'],
    })
  })

  it('P0004 (cooldown): rejeição tipada com nextAllowedAt parseado de details', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: 'P0004',
        details: '2026-08-25T14:00:00Z',
        message: 'Aguarde antes de tentar novamente.',
      },
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const { result } = renderHook(() => useSubmitQuiz('m1', 'u1'), {
      wrapper: makeWrapper(queryClient),
    })

    result.current.submit({ q1: 'o1' })

    await waitFor(() => expect(result.current.rejection).not.toBeNull())
    expect(result.current.rejection?.code).toBe('cooldown')
    expect(result.current.rejection?.nextAllowedAt?.toISOString()).toBe(
      '2026-08-25T14:00:00.000Z',
    )
    expect(result.current.result).toBeUndefined()
  })

  it('P0003 => cap; P0005 => no_questions (ramifica por SQLSTATE, não pela mensagem)', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0003', message: 'qualquer texto' },
    })
    const { result, rerender } = renderHook(() => useSubmitQuiz('m1', 'u1'), {
      wrapper: makeWrapper(queryClient),
    })
    result.current.submit({})
    await waitFor(() => expect(result.current.rejection?.code).toBe('cap'))

    result.current.reset()
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0005', message: 'outro texto' },
    })
    rerender()
    result.current.submit({})
    await waitFor(() =>
      expect(result.current.rejection?.code).toBe('no_questions'),
    )
  })
})
