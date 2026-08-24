/**
 * TopNav — barra de navegação superior (dark / streaming), sticky.
 * Presentational: links passados como `children`; ação de sair via `onSignOut`.
 */
import type { ReactNode } from 'react'

interface TopNavProps {
  userName: string
  role?: string
  onSignOut?: () => void
  /** Links de navegação (presentational). */
  children?: ReactNode
}

export function TopNav({ userName, role, onSignOut, children }: TopNavProps) {
  const initial = userName.trim().charAt(0).toUpperCase() || '?'

  return (
    <header className="sticky top-0 z-40 border-b border-cpj-royal/15 bg-cpj-bg/70 backdrop-blur-lg">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        {/* Wordmark */}
        <span className="flex items-center gap-2 font-bold tracking-tight text-cpj-white">
          <span className="text-cpj-coral">ContrataPJ</span>
          <span className="text-cpj-white/90">Academy</span>
        </span>

        {/* Links */}
        {children && (
          <div className="hidden items-center gap-4 text-sm text-cpj-white/70 sm:flex">
            {children}
          </div>
        )}

        {/* Usuário */}
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right leading-tight sm:block">
            <div className="text-sm font-medium text-cpj-white">{userName}</div>
            {role && (
              <div className="text-xs capitalize text-cpj-white/50">{role}</div>
            )}
          </div>
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-cpj-royal text-sm font-semibold text-cpj-white"
          >
            {initial}
          </span>
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-cpj-white/70 transition hover:bg-cpj-white/10 hover:text-cpj-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal"
            >
              Sair
            </button>
          )}
        </div>
      </nav>
    </header>
  )
}
