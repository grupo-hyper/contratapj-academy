import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import type { Role } from './authContext'

/**
 * Guarda de rota por autenticação e papel.
 *
 * Regras:
 * 1. Enquanto a sessão ainda resolve (`loading`), renderiza um estado leve de
 *    carregamento — NÃO redireciona, pra evitar mandar pro /login antes da
 *    sessão hidratar (flicker de redirect).
 * 2. Sem usuário → redireciona pro /login.
 * 3. Usuário existe mas o perfil ainda não chegou (edge: trigger de signup
 *    atrasado) → trata como ainda-não-autorizado e mostra o carregamento.
 * 4. `allow` definido e o papel não está na lista → bloqueia mandando pra
 *    home (/). A home é pública a qualquer autenticado, então é um destino
 *    seguro pra quem não tem permissão naquela rota.
 */
export function RequireRole({
  allow,
  children,
}: {
  allow?: Role[]
  children: ReactNode
}) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Usuário autenticado, mas o perfil (papel) ainda não resolveu.
  if (!profile) {
    return <LoadingScreen />
  }

  if (allow && !allow.includes(profile.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function LoadingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-cpj-bg text-cpj-white"
    >
      Carregando…
    </div>
  )
}
