/**
 * Teste de aceite da Home do aluno (Task 3.2):
 * "com dados mock, a Home mostra o módulo atual e trava os bloqueados".
 *
 * Estratégia: mockamos a CAMADA DE DADOS (`useHomeData`) e o `useAuth`, não o
 * DOM — assim o teste exercita a COMPOSIÇÃO real (Hero + Row + Tile) sobre um
 * estado determinístico, sem rede/Supabase. Asserções comportamentais: papéis,
 * texto e estados renderizados (aria-disabled para bloqueado), navegação.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { Lesson, Module } from '../../types/content'
import { computeUnlockState } from './useUnlock'
import type { HomeData } from './useHomeData'

// ---- Mock da navegação: capturamos para onde a Home tenta navegar ----------
const navigateSpy = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateSpy }
})

// ---- Mock do auth: aluno logado -------------------------------------------
const signOutSpy = vi.fn()
vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'ana@contratapj.com.br' },
    profile: { id: 'user-1', nome: 'Ana', role: 'aluno', avatar_url: null },
    loading: false,
    signIn: vi.fn(),
    signInWithPassword: vi.fn(),
    signInWithMagicLink: vi.fn(),
    signOut: signOutSpy,
  }),
}))

// ---- Mock da camada de dados ----------------------------------------------
const useHomeDataMock = vi.fn()
vi.mock('./useHomeData', () => ({
  useHomeData: () => useHomeDataMock(),
}))

// Importa a Home DEPOIS dos mocks.
import { HomePage } from './HomePage'

// ---- Fixtures --------------------------------------------------------------
// Títulos DISTINTOS do subtitle ("Módulo N") para que os getByRole por nome
// casem inequivocamente no título do Tile, e não no subtítulo.
const MODULE_TITLES: Record<number, string> = {
  1: 'Introdução',
  2: 'Prospecção',
  3: 'Fechamento',
}
function mod(ordem: number): Module {
  return {
    id: `m${ordem}`,
    ordem,
    titulo: MODULE_TITLES[ordem],
    descricao: `Descrição do módulo ${ordem}`,
    capa_url: null,
    publicado: true,
    created_at: '2026-01-01T00:00:00Z',
  }
}
function lesson(id: string, moduleId: string, ordem: number): Lesson {
  return {
    id,
    module_id: moduleId,
    ordem,
    titulo: `Aula ${ordem} do ${moduleId}`,
    texto_md: null,
    youtube_id: null,
    duracao_seg: null,
    publicado: true,
    created_at: '2026-01-01T00:00:00Z',
  }
}

/** Monta um HomeData de 3 módulos onde o módulo 1 é o current e 2/3 travados. */
function buildData(): HomeData {
  const modules = [mod(1), mod(2), mod(3)]
  const lessonsByModule = {
    m1: [lesson('l1a', 'm1', 1), lesson('l1b', 'm1', 2)],
    m2: [lesson('l2a', 'm2', 1)],
    m3: [lesson('l3a', 'm3', 1)],
  }
  // Nada concluído => m1 current, m2/m3 locked.
  const concludedLessonIds = new Set<string>()
  const unlockState = computeUnlockState({ modules, lessonsByModule, concludedLessonIds })
  return { modules, lessonsByModule, concludedLessonIds, unlockState, quizByModule: {} }
}

function renderHome() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('HomePage — dashboard do aluno', () => {
  it('mostra o módulo atual como current e trava os bloqueados', async () => {
    useHomeDataMock.mockReturnValue({
      data: buildData(),
      isLoading: false,
      isError: false,
      error: null,
    })
    renderHome()

    // O módulo 1 (current) é acionável: seu botão NÃO tem aria-disabled.
    const modulo1 = screen.getByRole('button', { name: /Introdução/i })
    expect(modulo1).not.toHaveAttribute('aria-disabled')

    // O módulo 3 (locked) é não-acionável: aria-disabled presente.
    const modulo3 = screen.getByRole('button', { name: /Fechamento/i })
    expect(modulo3).toHaveAttribute('aria-disabled', 'true')

    // Módulo 2 também travado.
    const modulo2 = screen.getByRole('button', { name: /Prospecção/i })
    expect(modulo2).toHaveAttribute('aria-disabled', 'true')
  })

  it('o Hero "continue" aponta pra primeira aula não concluída do módulo atual', async () => {
    useHomeDataMock.mockReturnValue({
      data: buildData(),
      isLoading: false,
      isError: false,
      error: null,
    })
    renderHome()

    // Título do Hero = aula corrente (primeira não concluída do m1).
    expect(
      screen.getByRole('heading', { name: /Aula 1 do m1/i }),
    ).toBeInTheDocument()

    // Clicar em "Começar" navega para o player daquela aula.
    fireEvent.click(screen.getByRole('button', { name: /começar/i }))
    expect(navigateSpy).toHaveBeenCalledWith('/aula/l1a')
  })

  it('clicar num módulo bloqueado não navega', async () => {
    useHomeDataMock.mockReturnValue({
      data: buildData(),
      isLoading: false,
      isError: false,
      error: null,
    })
    renderHome()

    fireEvent.click(screen.getByRole('button', { name: /Fechamento/i }))
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it('mostra esqueleto de carregamento', () => {
    useHomeDataMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    })
    const { container } = renderHome()
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })
})
