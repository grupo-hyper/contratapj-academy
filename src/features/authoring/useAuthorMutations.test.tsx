/**
 * useAuthorMutations: mutations de gestão de módulos/aulas (F2). Mockamos o
 * supabase roteando por tabela e verificamos os args de cada operação + a
 * invalidação das chaves do autor E do aluno.
 *
 * Reorder é o ponto crítico: precisa ser UM único upsert com as duas linhas de
 * ordem já trocada (não dois updates — colidiriam na constraint UNIQUE).
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// Builder encadeável por tabela. select()...limit() resolve os dados de "maior
// ordem"; insert/update/delete/upsert resolvem sucesso e guardam os args.
const insertMock = vi.fn().mockResolvedValue({ error: null })
const updateEqMock = vi.fn().mockResolvedValue({ error: null })
const updateMock = vi.fn(() => ({ eq: updateEqMock }))
const deleteEqMock = vi.fn().mockResolvedValue({ error: null })
const deleteMock = vi.fn(() => ({ eq: deleteEqMock }))
const upsertMock = vi.fn().mockResolvedValue({ error: null })

// select().eq().order().limit() e select().order().limit() → maior ordem.
// Controlável por teste via `maxOrdemByTable`.
let maxOrdem = 2
const limitMock = vi.fn(() =>
  Promise.resolve({ data: [{ ordem: maxOrdem }], error: null }),
)
const orderMock = vi.fn(() => ({ limit: limitMock, order: orderMock }))
const selectEqMock = vi.fn(() => ({ order: orderMock }))
const selectMock = vi.fn(() => ({ order: orderMock, eq: selectEqMock }))

const fromMock = vi.fn((_table: string) => ({
  select: selectMock,
  insert: insertMock,
  update: updateMock,
  delete: deleteMock,
  upsert: upsertMock,
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { from: (t: string) => fromMock(t) },
}))

import { useAuthorMutations } from './useAuthorMutations'

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
  const { result } = renderHook(() => useAuthorMutations(), {
    wrapper: makeWrapper(qc),
  })
  return { result, invalidateSpy }
}

afterEach(() => {
  vi.clearAllMocks()
  maxOrdem = 2
})

describe('useAuthorMutations', () => {
  it('createModule insere com ordem = maior + 1 e defaults', async () => {
    maxOrdem = 2
    const { result, invalidateSpy } = setup()
    result.current.createModule()

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1))
    expect(fromMock).toHaveBeenCalledWith('modules')
    expect(insertMock).toHaveBeenCalledWith({
      ordem: 3,
      titulo: 'Novo módulo',
      publicado: false,
    })
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['modules'] }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['author_tree', 'modules'],
    })
  })

  it('updateModule faz update pelo id com o patch', async () => {
    const { result, invalidateSpy } = setup()
    result.current.updateModule('m1', { titulo: 'X', publicado: true })

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
    expect(updateMock).toHaveBeenCalledWith({ titulo: 'X', publicado: true })
    expect(updateEqMock).toHaveBeenCalledWith('id', 'm1')
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['modules'] }),
    )
  })

  it('deleteModule apaga pelo id', async () => {
    const { result } = setup()
    result.current.deleteModule('m1')

    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1))
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'm1')
  })

  it('createLesson insere no módulo com ordem = maior + 1 e defaults', async () => {
    maxOrdem = 5
    const { result } = setup()
    result.current.createLesson('m1')

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1))
    expect(insertMock).toHaveBeenCalledWith({
      module_id: 'm1',
      ordem: 6,
      titulo: 'Nova aula',
      publicado: false,
    })
    expect(selectEqMock).toHaveBeenCalledWith('module_id', 'm1')
  })

  it('deleteLesson apaga pelo id', async () => {
    const { result } = setup()
    result.current.deleteLesson('l1')

    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1))
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'l1')
  })

  it('reorderModules faz UM upsert com as duas ordens trocadas', async () => {
    const { result } = setup()
    result.current.reorderModules({ id: 'm1', ordem: 1 }, { id: 'm2', ordem: 2 })

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1))
    expect(upsertMock).toHaveBeenCalledWith([
      { id: 'm1', ordem: 2 },
      { id: 'm2', ordem: 1 },
    ])
  })

  it('reorderLessons faz UM upsert com as duas ordens trocadas', async () => {
    const { result } = setup()
    result.current.reorderLessons({ id: 'l1', ordem: 3 }, { id: 'l2', ordem: 4 })

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1))
    expect(upsertMock).toHaveBeenCalledWith([
      { id: 'l1', ordem: 4 },
      { id: 'l2', ordem: 3 },
    ])
  })
})
