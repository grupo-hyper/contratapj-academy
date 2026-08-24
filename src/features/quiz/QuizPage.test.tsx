/**
 * Teste de aceite do motor de teste (Task 4.2): renderiza questões; responder
 * todas habilita o envio; enviar chama a mutation; cooldown (P0004) renderiza o
 * estado bloqueado; já aprovado esconde o formulário.
 *
 * Estratégia: mockamos a CAMADA DE DADOS (`useQuiz`) e o `useAuth`, renderizando
 * a COMPOSIÇÃO real. Sem rede/Supabase — mesma tática de LessonPage.test.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { AttemptGate } from './quizRules'

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'ana@contratapj.com.br' },
    profile: { id: 'user-1', nome: 'Ana', role: 'aluno', avatar_url: null },
    loading: false,
    signOut: vi.fn(),
  }),
}))

const useQuizDataMock = vi.fn()
const submitMock = vi.fn()
const useSubmitQuizMock = vi.fn()
vi.mock('./useQuiz', () => ({
  useQuizData: (...a: unknown[]) => useQuizDataMock(...a),
  useSubmitQuiz: (...a: unknown[]) => useSubmitQuizMock(...a),
}))

import { QuizPage } from './QuizPage'

const OPEN_GATE: AttemptGate = {
  attemptsUsed: 0,
  attemptsLeft: 3,
  passed: false,
  canAttempt: true,
  blockedReason: null,
  nextAllowedAt: null,
}

function questionsFixture() {
  return [
    {
      question: { id: 'q1', module_id: 'm1', enunciado: 'Pergunta 1', created_at: '' },
      options: [
        { id: 'o1a', question_id: 'q1', texto: 'Alt A' },
        { id: 'o1b', question_id: 'q1', texto: 'Alt B' },
      ],
    },
    {
      question: { id: 'q2', module_id: 'm1', enunciado: 'Pergunta 2', created_at: '' },
      options: [
        { id: 'o2a', question_id: 'q2', texto: 'Alt C' },
        { id: 'o2b', question_id: 'q2', texto: 'Alt D' },
      ],
    },
  ]
}

function setSubmit(overrides: Record<string, unknown> = {}) {
  useSubmitQuizMock.mockReturnValue({
    submit: submitMock,
    isSubmitting: false,
    result: undefined,
    rejection: null,
    reset: vi.fn(),
    ...overrides,
  })
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/quiz/m1']}>
        <Routes>
          <Route path="/quiz/:moduleId" element={<QuizPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('QuizPage — motor do teste', () => {
  it('renderiza as questões e habilita o envio só após responder todas', () => {
    useQuizDataMock.mockReturnValue({
      questions: questionsFixture(),
      gate: OPEN_GATE,
      attempts: [],
      isLoading: false,
      isError: false,
      error: null,
    })
    setSubmit()
    renderPage()

    expect(screen.getByText(/Pergunta 1/)).toBeInTheDocument()
    expect(screen.getByText(/Pergunta 2/)).toBeInTheDocument()

    const submitBtn = screen.getByRole('button', { name: /enviar teste/i })
    // Nada respondido => desabilitado.
    expect(submitBtn).toBeDisabled()

    // Responde só a primeira => ainda desabilitado.
    fireEvent.click(screen.getByLabelText('Alt A'))
    expect(submitBtn).toBeDisabled()

    // Responde a segunda => habilita.
    fireEvent.click(screen.getByLabelText('Alt C'))
    expect(submitBtn).toBeEnabled()
  })

  it('enviar chama a mutation com as respostas selecionadas', () => {
    useQuizDataMock.mockReturnValue({
      questions: questionsFixture(),
      gate: OPEN_GATE,
      attempts: [],
      isLoading: false,
      isError: false,
      error: null,
    })
    setSubmit()
    renderPage()

    fireEvent.click(screen.getByLabelText('Alt B'))
    fireEvent.click(screen.getByLabelText('Alt D'))
    fireEvent.click(screen.getByRole('button', { name: /enviar teste/i }))

    expect(submitMock).toHaveBeenCalledTimes(1)
    expect(submitMock).toHaveBeenCalledWith({ q1: 'o1b', q2: 'o2b' })
  })

  it('cooldown (P0004) renderiza estado bloqueado com o instante em BRT, sem formulário', () => {
    useQuizDataMock.mockReturnValue({
      questions: questionsFixture(),
      gate: OPEN_GATE,
      attempts: [],
      isLoading: false,
      isError: false,
      error: null,
    })
    setSubmit({
      rejection: {
        kind: 'rejection',
        code: 'cooldown',
        nextAllowedAt: new Date('2026-08-25T14:00:00Z'),
        message: 'Aguarde antes de tentar novamente.',
      },
    })
    renderPage()

    expect(screen.getByText(/aguarde para tentar novamente/i)).toBeInTheDocument()
    // 14:00Z = 11:00 em Brasília (UTC-3).
    expect(screen.getByText(/11:00/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /enviar teste/i }),
    ).not.toBeInTheDocument()
  })

  it('quando já aprovado, esconde o formulário e mostra sucesso', () => {
    useQuizDataMock.mockReturnValue({
      questions: questionsFixture(),
      gate: { ...OPEN_GATE, passed: true, canAttempt: false },
      attempts: [],
      isLoading: false,
      isError: false,
      error: null,
    })
    setSubmit()
    renderPage()

    expect(screen.getByText(/módulo aprovado/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /enviar teste/i }),
    ).not.toBeInTheDocument()
  })

  it('resultado pós-envio mostra nota e acertos/total', () => {
    useQuizDataMock.mockReturnValue({
      questions: questionsFixture(),
      gate: OPEN_GATE,
      attempts: [],
      isLoading: false,
      isError: false,
      error: null,
    })
    setSubmit({
      result: {
        nota: 90,
        aprovado: true,
        acertos: 9,
        total: 10,
        tentativa: 1,
        tentativas_restantes: 2,
        proxima_liberacao: null,
      },
    })
    renderPage()

    expect(screen.getByText('90%')).toBeInTheDocument()
    expect(screen.getByText(/9 de 10 corretas/i)).toBeInTheDocument()
    expect(screen.getByText(/aprovado ✓/i)).toBeInTheDocument()
  })
})
