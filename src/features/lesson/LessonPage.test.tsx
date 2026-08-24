/**
 * Teste de aceite do player de aula (Task 3.3): abrir a aula mostra vídeo (quando
 * houver) + texto; marcar concluída chama a mutation; já concluída mostra o
 * estado concluído.
 *
 * Estratégia: mockamos a CAMADA DE DADOS (`useLesson`) e o `useAuth`, renderizando
 * a COMPOSIÇÃO real (TopNav + LessonVideo + LessonText + botão). Sem rede/Supabase.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { Lesson } from '../../types/content'

// ---- Mock do auth: aluno logado -------------------------------------------
vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'ana@contratapj.com.br' },
    profile: { id: 'user-1', nome: 'Ana', role: 'aluno', avatar_url: null },
    loading: false,
    signOut: vi.fn(),
  }),
}))

// ---- Mock da camada de dados ----------------------------------------------
const useLessonMock = vi.fn()
vi.mock('./useLesson', () => ({
  useLesson: (...args: unknown[]) => useLessonMock(...args),
}))

import { LessonPage } from './LessonPage'

function baseLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'l1',
    module_id: 'm1',
    ordem: 1,
    titulo: 'Como prospectar clientes',
    texto_md: '# Bem-vindo\n\nEste é o **conteúdo** da aula.',
    youtube_id: null,
    duracao_seg: null,
    publicado: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/aula/l1']}>
        <Routes>
          <Route path="/aula/:lessonId" element={<LessonPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('LessonPage — player da aula', () => {
  it('renderiza título + texto em markdown e o placeholder quando não há vídeo', () => {
    useLessonMock.mockReturnValue({
      lesson: baseLesson(),
      concluida: false,
      isLoading: false,
      isError: false,
      markConcluded: vi.fn(),
      isMarking: false,
    })
    renderPage()

    expect(
      screen.getByRole('heading', { name: /Como prospectar clientes/i, level: 1 }),
    ).toBeInTheDocument()
    // Texto do markdown renderizado (heading do texto_md).
    expect(
      screen.getByRole('heading', { name: /Bem-vindo/i }),
    ).toBeInTheDocument()
    // Sem youtube_id => placeholder "vídeo em breve".
    expect(screen.getByLabelText(/vídeo em breve/i)).toBeInTheDocument()
  })

  it('renderiza o iframe do vídeo quando há youtube_id', () => {
    useLessonMock.mockReturnValue({
      lesson: baseLesson({ youtube_id: 'abc123' }),
      concluida: false,
      isLoading: false,
      isError: false,
      markConcluded: vi.fn(),
      isMarking: false,
    })
    const { container } = renderPage()

    const iframe = container.querySelector('iframe')
    expect(iframe).toBeTruthy()
    expect(iframe?.getAttribute('src')).toContain('abc123')
  })

  it('clicar em "Marcar como concluída" chama a mutation', () => {
    const markConcluded = vi.fn()
    useLessonMock.mockReturnValue({
      lesson: baseLesson(),
      concluida: false,
      isLoading: false,
      isError: false,
      markConcluded,
      isMarking: false,
    })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /marcar como concluída/i }))
    expect(markConcluded).toHaveBeenCalledTimes(1)
  })

  it('quando já concluída, mostra estado concluído (botão desabilitado)', () => {
    useLessonMock.mockReturnValue({
      lesson: baseLesson(),
      concluida: true,
      isLoading: false,
      isError: false,
      markConcluded: vi.fn(),
      isMarking: false,
    })
    renderPage()

    const btn = screen.getByRole('button', { name: /concluída/i })
    expect(btn).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: /marcar como concluída/i }),
    ).not.toBeInTheDocument()
  })

  it('mostra estado de não encontrada quando a aula não existe', () => {
    useLessonMock.mockReturnValue({
      lesson: null,
      concluida: false,
      isLoading: false,
      isError: false,
      markConcluded: vi.fn(),
      isMarking: false,
    })
    renderPage()

    expect(screen.getByText(/aula não encontrada/i)).toBeInTheDocument()
  })
})
