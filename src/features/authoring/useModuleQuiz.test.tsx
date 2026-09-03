/**
 * useModuleQuiz: camada de dados do editor de quiz (F3). Mockamos o supabase
 * roteando por tabela e verificamos: o READ agrupa alternativas por pergunta
 * (com `correta`, lidas da TABELA BASE `question_options`, não da view pública);
 * cada mutation com seus args; e o setCorrectOption fazendo DUAS updates (zera a
 * pergunta, depois marca a alternativa).
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// Dados de READ por tabela.
const questionsData = [
  { id: 'q1', module_id: 'm1', enunciado: 'Q1', created_at: 't1' },
  { id: 'q2', module_id: 'm1', enunciado: 'Q2', created_at: 't2' },
]
const optionsData = [
  { id: 'o1', question_id: 'q1', texto: 'A', correta: true, created_at: 't' },
  { id: 'o2', question_id: 'q1', texto: 'B', correta: false, created_at: 't' },
  { id: 'o3', question_id: 'q2', texto: 'C', correta: false, created_at: 't' },
]

// Builders de READ: questions usa select().eq().order(); options usa
// select().in().order(). Roteamos pela tabela pedida em `from`.
const insertMock = vi.fn().mockResolvedValue({ error: null })
const updateEqMock = vi.fn().mockResolvedValue({ error: null })
const updateMock = vi.fn(() => ({ eq: updateEqMock }))
const deleteEqMock = vi.fn().mockResolvedValue({ error: null })
const deleteMock = vi.fn(() => ({ eq: deleteEqMock }))

function makeSelect(table: string) {
  if (table === 'questions') {
    const order = vi.fn(() =>
      Promise.resolve({ data: questionsData, error: null }),
    )
    const eq = vi.fn(() => ({ order }))
    return vi.fn(() => ({ eq }))
  }
  // question_options
  const order = vi.fn(() =>
    Promise.resolve({ data: optionsData, error: null }),
  )
  const inMock = vi.fn(() => ({ order }))
  return vi.fn(() => ({ in: inMock }))
}

const fromMock = vi.fn((table: string) => ({
  select: makeSelect(table),
  insert: insertMock,
  update: updateMock,
  delete: deleteMock,
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { from: (t: string) => fromMock(t) },
}))

import { useModuleQuiz } from './useModuleQuiz'

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
  const { result } = renderHook(() => useModuleQuiz('m1'), {
    wrapper: makeWrapper(qc),
  })
  return { result, invalidateSpy }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('useModuleQuiz', () => {
  it('lê perguntas e agrupa alternativas (com correta) da tabela base', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.questions).toHaveLength(2))

    expect(fromMock).toHaveBeenCalledWith('questions')
    expect(fromMock).toHaveBeenCalledWith('question_options')

    const [q1, q2] = result.current.questions
    expect(q1).toEqual({
      id: 'q1',
      enunciado: 'Q1',
      options: [
        { id: 'o1', texto: 'A', correta: true },
        { id: 'o2', texto: 'B', correta: false },
      ],
    })
    expect(q2.options).toEqual([{ id: 'o3', texto: 'C', correta: false }])
  })

  it('createQuestion insere {module_id, enunciado} e invalida as chaves', async () => {
    const { result, invalidateSpy } = setup()
    await waitFor(() => expect(result.current.questions).toHaveLength(2))

    result.current.createQuestion('Nova pergunta')
    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1))
    expect(insertMock).toHaveBeenCalledWith({
      module_id: 'm1',
      enunciado: 'Nova pergunta',
    })
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['quiz_questions', 'm1'],
      }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['modules_with_quiz'],
    })
  })

  it('updateQuestion faz update do enunciado pelo id', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.questions).toHaveLength(2))

    result.current.updateQuestion('q1', 'Editada')
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
    expect(updateMock).toHaveBeenCalledWith({ enunciado: 'Editada' })
    expect(updateEqMock).toHaveBeenCalledWith('id', 'q1')
  })

  it('deleteQuestion apaga a pergunta pelo id', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.questions).toHaveLength(2))

    result.current.deleteQuestion('q1')
    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1))
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'q1')
  })

  it('createOption insere {question_id, texto, correta:false}', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.questions).toHaveLength(2))

    result.current.createOption('q1', 'Nova alt')
    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1))
    expect(insertMock).toHaveBeenCalledWith({
      question_id: 'q1',
      texto: 'Nova alt',
      correta: false,
    })
  })

  it('updateOptionText faz update do texto pelo id', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.questions).toHaveLength(2))

    result.current.updateOptionText('o1', 'A corrigida')
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
    expect(updateMock).toHaveBeenCalledWith({ texto: 'A corrigida' })
    expect(updateEqMock).toHaveBeenCalledWith('id', 'o1')
  })

  it('deleteOption apaga a alternativa pelo id', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.questions).toHaveLength(2))

    result.current.deleteOption('o2')
    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1))
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'o2')
  })

  it('setCorrectOption faz DUAS updates: zera a pergunta, depois marca a alternativa', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.questions).toHaveLength(2))

    result.current.setCorrectOption('q1', 'o2')
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(2))
    // 1ª: zera correta de todas as alternativas da pergunta.
    expect(updateMock).toHaveBeenNthCalledWith(1, { correta: false })
    expect(updateEqMock).toHaveBeenNthCalledWith(1, 'question_id', 'q1')
    // 2ª: marca a alternativa escolhida.
    expect(updateMock).toHaveBeenNthCalledWith(2, { correta: true })
    expect(updateEqMock).toHaveBeenNthCalledWith(2, 'id', 'o2')
  })
})
