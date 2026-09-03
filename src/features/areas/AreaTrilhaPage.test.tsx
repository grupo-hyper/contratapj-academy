/**
 * Teste de aceite da AreaTrilhaPage (Task 6, Fase 1 de Áreas):
 * "resolve :slug -> área e renderiza a MESMA UI da trilha (HomePage) escopada
 * a essa área; slug inexistente mostra 'Área não encontrada'".
 *
 * Estratégia: mockamos `useAreas` (camada de dados das Áreas) e, como a página
 * delega a renderização real para `<HomePage areaId={...} />`, também mockamos
 * `useHomeData` e `useAuth` (mesmo padrão de HomePage.test.tsx) para exercitar
 * a composição real (Hero + Row + Tile) sem rede/Supabase.
 */
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Area } from '../../types/content'
import { computeUnlockState } from '../home/useUnlock'
import type { HomeData } from '../home/useHomeData'

// ---- Mock do auth: aluno logado -------------------------------------------
vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'ana@contratapj.com.br' },
    profile: { id: 'user-1', nome: 'Ana', role: 'aluno', avatar_url: null },
    loading: false,
    signIn: vi.fn(),
    signInWithPassword: vi.fn(),
    signInWithMagicLink: vi.fn(),
    signOut: vi.fn(),
  }),
}))

// ---- Mock da camada de dados da Home (consumida internamente por HomePage) -
const useHomeDataMock = vi.fn()
vi.mock('../home/useHomeData', () => ({
  useHomeData: (...a: unknown[]) => useHomeDataMock(...a),
}))

// ---- Mock da camada de dados das Áreas -------------------------------------
const useAreasMock = vi.fn()
vi.mock('./useAreas', () => ({
  useAreas: () => useAreasMock(),
}))

// Importa a página DEPOIS dos mocks.
import { AreaTrilhaPage } from './AreaTrilhaPage'

function area(overrides?: Partial<Area>): Area {
  return {
    id: 'area-comercial',
    nome: 'Comercial',
    slug: 'comercial',
    descricao: null,
    capa_url: null,
    visibilidade: 'publica',
    ordem: 1,
    publicado: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function buildHomeData(): HomeData {
  const modules = [
    {
      id: 'm1',
      area_id: 'area-comercial',
      ordem: 1,
      titulo: 'Prospecção',
      descricao: 'Descrição do módulo 1',
      capa_url: null,
      publicado: true,
      created_at: '2026-01-01T00:00:00Z',
    },
  ]
  const lessonsByModule = {
    m1: [
      {
        id: 'l1a',
        module_id: 'm1',
        ordem: 1,
        titulo: 'Aula 1 do m1',
        texto_md: null,
        youtube_id: null,
        duracao_seg: null,
        publicado: true,
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
  }
  const concludedLessonIds = new Set<string>()
  const quizByModule = {}
  const unlockState = computeUnlockState({
    modules,
    lessonsByModule,
    concludedLessonIds,
    quizPassedByModule: {},
  })
  return { modules, lessonsByModule, concludedLessonIds, unlockState, quizByModule }
}

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/area/:slug" element={<AreaTrilhaPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('AreaTrilhaPage — trilha da área (/area/:slug)', () => {
  it('resolve o slug para a área e renderiza a trilha (módulos) daquela área', () => {
    useAreasMock.mockReturnValue({
      areas: [area({ slug: 'comercial' })],
      isLoading: false,
      isError: false,
      error: null,
    })
    useHomeDataMock.mockReturnValue({
      data: buildHomeData(),
      isLoading: false,
      isError: false,
      error: null,
    })

    renderAt('/area/comercial')

    // Prova que a HomePage real foi montada com os módulos da área mockada.
    expect(screen.getByRole('button', { name: /Prospecção/i })).toBeInTheDocument()
    // useHomeData deve ter sido chamado escopado à área resolvida.
    expect(useHomeDataMock).toHaveBeenCalledWith('user-1', 'area-comercial')
  })

  it('slug inexistente mostra "Área não encontrada"', () => {
    useAreasMock.mockReturnValue({
      areas: [area({ slug: 'comercial' })],
      isLoading: false,
      isError: false,
      error: null,
    })
    useHomeDataMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    })

    renderAt('/area/nao-existe')

    expect(screen.getByText(/área não encontrada/i)).toBeInTheDocument()
  })

  it('enquanto useAreas carrega, mostra estado de carregamento (sem "não encontrada")', () => {
    useAreasMock.mockReturnValue({
      areas: [],
      isLoading: true,
      isError: false,
      error: null,
    })
    useHomeDataMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    })

    renderAt('/area/comercial')

    expect(screen.queryByText(/área não encontrada/i)).not.toBeInTheDocument()
  })
})
