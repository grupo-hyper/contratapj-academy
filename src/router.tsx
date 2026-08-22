import {
  createBrowserRouter,
  Navigate,
  type RouteObject,
} from 'react-router-dom'
import { LoginPage } from './features/auth/LoginPage'
import { RequireRole } from './auth/RequireRole'
import { AutorStub, GestorStub, HomeStub } from './features/_stubs'

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireRole>
        <HomeStub />
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
