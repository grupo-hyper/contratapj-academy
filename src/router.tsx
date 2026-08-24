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
