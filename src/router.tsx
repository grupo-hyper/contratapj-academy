import { lazy, Suspense } from 'react'
import {
  createBrowserRouter,
  Navigate,
  type RouteObject,
} from 'react-router-dom'
import { LoginPage } from './features/auth/LoginPage'
import { RequireRole } from './auth/RequireRole'
import { AppLayout } from './components/AppLayout'
import { AutorStub, GestorStub } from './features/_stubs'
import { HomePage } from './features/home/HomePage'
import { LessonPage } from './features/lesson/LessonPage'
import { QuizPage } from './features/quiz/QuizPage'

// Lazy-load só esta rota: tira o `pdf-lib` (+ deps) do bundle inicial eager.
// As demais rotas seguem eager (padrão do repo, churn mínimo).
const CertificatesPage = lazy(
  () => import('./features/certificates/CertificatesPage'),
)

/**
 * Fallback dark mínimo enquanto o chunk de /certificados carrega. Elemento (não
 * componente) para não disparar o lint `only-export-components` neste módulo,
 * que já exporta `routes`/`router` (não-componentes) de propósito. Mesmo visual
 * do LoadingScreen de RequireRole.
 */
const routeFallback = (
  <div
    role="status"
    aria-live="polite"
    className="flex min-h-screen items-center justify-center bg-cpj-bg text-cpj-white"
  >
    Carregando…
  </div>
)

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    // Área autenticada: o <AppLayout> (sidebar + Outlet) é o shell comum. Um
    // único RequireRole protege todas as filhas (qualquer papel logado).
    element: (
      <RequireRole>
        <AppLayout />
      </RequireRole>
    ),
    children: [
      { path: '/', element: <HomePage /> },
      // Player da aula. Qualquer papel autenticado (como a Home).
      { path: '/aula/:lessonId', element: <LessonPage /> },
      // Motor do teste do módulo. Qualquer papel autenticado.
      { path: '/quiz/:moduleId', element: <QuizPage /> },
      {
        // Tela "Meus certificados". Qualquer papel autenticado.
        path: '/certificados',
        element: (
          <Suspense fallback={routeFallback}>
            <CertificatesPage />
          </Suspense>
        ),
      },
      {
        // Painel do gestor. Dentro do AppLayout (com sidebar); o RequireRole
        // interno restringe a gestor — admins (allowlist) passam pelo bypass.
        path: '/gestor',
        element: (
          <RequireRole allow={['gestor']}>
            <GestorStub />
          </RequireRole>
        ),
      },
      {
        // CMS do autor. Idem: dentro do layout, restrito a autor (+ admins).
        path: '/autor',
        element: (
          <RequireRole allow={['autor']}>
            <AutorStub />
          </RequireRole>
        ),
      },
    ],
  },
  // Catch-all: rota desconhecida volta pra home.
  { path: '*', element: <Navigate to="/" replace /> },
]

export const router = createBrowserRouter(routes)
