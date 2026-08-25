/**
 * AppLayout — shell da área autenticada (Task sidebar).
 *
 * Layout route (react-router): renderiza a <AppSidebar> à esquerda e o conteúdo
 * da rota no <Outlet>. A navegação global mora aqui (deixou de ser repetida em
 * cada página via TopNav).
 *
 * Responsividade:
 *  - Desktop (md+): sidebar fixa no fluxo, sempre visível.
 *  - Mobile: sidebar vira drawer off-canvas, aberto por um botão hambúrguer
 *    flutuante (não há topbar — decisão de design). Clicar num link ou no
 *    backdrop fecha o drawer.
 */
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { isAdminEmail } from '../auth/admins'
import { AppSidebar } from './AppSidebar'

export function AppLayout() {
  const { profile, user, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const userName = profile?.nome ?? user?.email ?? 'Aluno'
  const role = profile?.role
  const isAdmin = isAdminEmail(user?.email)

  return (
    <div className="ocean-bg flex min-h-dvh text-cpj-white">
      {/* Sidebar do desktop: parte do fluxo, sticky ao rolar. */}
      <div className="sticky top-0 hidden h-dvh md:block">
        <AppSidebar
          userName={userName}
          role={role}
          onSignOut={signOut}
          isAdmin={isAdmin}
        />
      </div>

      {/* Botão hambúrguer (só mobile). */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu"
        aria-expanded={mobileOpen}
        className="ocean-glass fixed left-3 top-3 z-50 rounded-lg p-2 text-cpj-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal md:hidden"
      >
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Drawer mobile (off-canvas). */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 h-full w-full bg-black/60"
          />
          <div className="absolute inset-y-0 left-0 shadow-2xl">
            <AppSidebar
              userName={userName}
              role={role}
              onSignOut={signOut}
              onNavigate={() => setMobileOpen(false)}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      )}

      {/* Conteúdo da rota. min-w-0 evita overflow de filhos flex; o pt no
          mobile reserva espaço para o botão hambúrguer flutuante. */}
      <div className="min-w-0 flex-1 pt-14 md:pt-0">
        <Outlet />
      </div>
    </div>
  )
}
