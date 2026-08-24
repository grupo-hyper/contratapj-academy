import { lazy, Suspense } from 'react'
import {
  createBrowserRouter,
  Navigate,
  type RouteObject,
} from 'react-router-dom'
import { LoginPage } from './features/auth/LoginPage'
import { RequireRole } from './auth/RequireRole'
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
    path: '/',
    element: (
      <RequireRole>
        <HomePage />
      </RequireRole>
    ),
  },
  {
    // Player da aula. Qualquer papel autenticado (como a Home): sem `allow`.
    path: '/aula/:lessonId',
    element: (
      <RequireRole>
        <LessonPage />
      </RequireRole>
    ),
  },
  {
    // Motor do teste do módulo. Qualquer papel autenticado (como a Home/aula).
    path: '/quiz/:moduleId',
    element: (
      <RequireRole>
        <QuizPage />
      </RequireRole>
    ),
  },
  {
    // Tela "Meus certificados". Qualquer papel autenticado (como a Home).
    path: '/certificados',
    element: (
      <RequireRole>
        <Suspense fallback={routeFallback}>
          <CertificatesPage />
        </Suspense>
      </RequireRole>
    ),
  },
  {
    path: '/gestor',
    element: (
      <RequireRole allow={['gestor']}>
        <GestorStub />
      </RequireRole>
    ),
  },
  {
    path: '/autor',
    element: (
      <RequireRole allow={['autor']}>
        <AutorStub />
      </RequireRole>
    ),
  },
  // Catch-all: rota desconhecida volta pra home.
  { path: '*', element: <Navigate to="/" replace /> },
]

export const router = createBrowserRouter(routes)
