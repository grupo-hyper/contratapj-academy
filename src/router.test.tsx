import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import type { Role } from './auth/authContext'

// ---- Supabase mock (sem rede, sem env) ------------------------------------
// Espelha o mock do AuthProvider.test: controla getSession (usuário) e
// maybeSingle (papel do perfil) pra dirigir o estado de auth por teste.
const mocks = vi.hoisted(() => {
  const unsubscribe = vi.fn()
  // O AuthProvider usa onAuthStateChange como única fonte da sessão: o mock
  // captura o callback e emite a sessão inicial (INITIAL_SESSION).
  const state: { initialSession?: unknown } = { initialSession: null }
  const onAuthStateChange = vi.fn(
    (cb: (event: string, session: unknown) => void) => {
      queueMicrotask(() => cb('INITIAL_SESSION', state.initialSession ?? null))
      return { data: { subscription: { unsubscribe } } }
    },
  )
  return {
    unsubscribe,
    state,
    getSession: vi.fn(),
    onAuthStateChange,
    maybeSingle: vi.fn(),
  }
})

vi.mock('./lib/supabase', () => {
  const eq = vi.fn(() => ({ maybeSingle: mocks.maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  return {
    supabase: {
      auth: {
        getSession: mocks.getSession,
        onAuthStateChange: mocks.onAuthStateChange,
        signInWithPassword: vi.fn(),
        signInWithOtp: vi.fn(),
        signOut: vi.fn(),
      },
      from,
    },
  }
})

// A Home usa react-query; mockamos o hook de dados para não tocar a rede e
// para renderizar um estado estável (sem módulos => marcador previsível).
vi.mock('./features/home/useHomeData', () => ({
  useHomeData: () => ({
    data: { modules: [], lessonsByModule: {}, concludedLessonIds: new Set(), unlockState: {} },
    isLoading: false,
    isError: false,
    error: null,
  }),
}))

// A rota /autor renderiza a AuthorPage (F1), que busca a árvore via
// useAuthorTree. Mockamos para um estado estável (sem rede): sem aulas
// selecionadas, o painel direito mostra "Selecione uma aula...".
vi.mock('./features/authoring/useAuthorTree', () => ({
  useAuthorTree: () => ({
    modules: [],
    lessonsByModule: {},
    isLoading: false,
    isError: false,
  }),
}))

// A rota /gestor renderiza a ManagerPage, que busca as turmas via
// useManagerClasses. Mockamos para um estado estável (sem rede): sem turma
// selecionada, o painel direito mostra "Selecione uma turma...".
vi.mock('./features/manager/useManagerClasses', () => ({
  useManagerClasses: () => ({
    classes: [],
    isLoading: false,
    isError: false,
    error: null,
    createClass: () => {},
    renameClass: () => {},
    deleteClass: () => {},
    setGoal: () => {},
    isMutating: false,
    isMutationError: false,
  }),
}))

// A raiz `/` agora renderiza a AreaHubPage (Task 7), e `/area/:slug` a
// AreaTrilhaPage — ambas usam useAreas. Mockamos para um estado estável (sem
// rede): nenhuma área publicada => marcador previsível no hub.
vi.mock('./features/areas/useAreas', () => ({
  useAreas: () => ({
    areas: [],
    isLoading: false,
    isError: false,
    error: null,
  }),
}))

// Importa DEPOIS do mock registrado.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './auth/AuthProvider'
import { routes } from './router'

const FAKE_USER = { id: 'user-1', email: 'ana@contratapj.com.br' }

/** Configura o mock para uma sessão autenticada com o papel dado. */
function signedInAs(role: Role) {
  mocks.state.initialSession = { user: FAKE_USER }
  mocks.maybeSingle.mockResolvedValue({
    data: { id: 'user-1', nome: 'Ana', role, avatar_url: null },
    error: null,
  })
}

/** Configura o mock para nenhuma sessão. */
function signedOut() {
  mocks.state.initialSession = null
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
}

/** Renderiza o app no caminho dado, dentro do AuthProvider + QueryClient. */
function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.state.initialSession = null
  // Reinstala a implementação que captura e dispara o callback (clearAllMocks
  // zera só o histórico; um mockReturnValue estático quebraria a emissão).
  mocks.onAuthStateChange.mockImplementation(
    (cb: (event: string, session: unknown) => void) => {
      queueMicrotask(() => cb('INITIAL_SESSION', mocks.state.initialSession ?? null))
      return { data: { subscription: { unsubscribe: mocks.unsubscribe } } }
    },
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('router + RequireRole', () => {
  it('não autenticado em / é redirecionado pro /login', async () => {
    signedOut()
    renderAt('/')

    expect(
      await screen.findByRole('heading', { name: /contratapj academy/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/nenhuma área publicada/i)).not.toBeInTheDocument()
  })

  it('aluno em /gestor é bloqueado (cai no hub de áreas)', async () => {
    signedInAs('aluno')
    renderAt('/gestor')

    expect(await screen.findByText(/nenhuma área publicada/i)).toBeInTheDocument()
    expect(screen.queryByText(/selecione uma turma/i)).not.toBeInTheDocument()
  })

  it('aluno em /autor é bloqueado (cai no hub de áreas)', async () => {
    signedInAs('aluno')
    renderAt('/autor')

    expect(await screen.findByText(/nenhuma área publicada/i)).toBeInTheDocument()
    expect(screen.queryByText(/selecione um módulo/i)).not.toBeInTheDocument()
  })

  it('gestor em /autor é bloqueado (cai no hub de áreas)', async () => {
    signedInAs('gestor')
    renderAt('/autor')

    expect(await screen.findByText(/nenhuma área publicada/i)).toBeInTheDocument()
    expect(screen.queryByText(/selecione um módulo/i)).not.toBeInTheDocument()
  })

  it('gestor em /gestor é liberado', async () => {
    signedInAs('gestor')
    renderAt('/gestor')

    expect(await screen.findByText(/selecione uma turma/i)).toBeInTheDocument()
  })

  it('autor em /autor é liberado', async () => {
    signedInAs('autor')
    renderAt('/autor')

    expect(await screen.findByText(/selecione um módulo/i)).toBeInTheDocument()
  })

  it('aluno em / é liberado (hub de áreas)', async () => {
    signedInAs('aluno')
    renderAt('/')

    expect(await screen.findByText(/nenhuma área publicada/i)).toBeInTheDocument()
  })

  it('rota desconhecida cai no hub de áreas', async () => {
    signedInAs('aluno')
    renderAt('/rota-que-nao-existe')

    expect(await screen.findByText(/nenhuma área publicada/i)).toBeInTheDocument()
  })

  it('aluno em /area/:slug com slug inexistente vê "Área não encontrada"', async () => {
    signedInAs('aluno')
    renderAt('/area/comercial')

    expect(await screen.findByText(/área não encontrada/i)).toBeInTheDocument()
  })
})
