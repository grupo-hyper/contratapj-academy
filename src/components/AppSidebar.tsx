/**
 * AppSidebar — menu lateral (dark / streaming), presentational.
 *
 * Substitui a antiga TopNav como navegação global: wordmark no topo, links de
 * navegação (com estado ativo via NavLink) no meio, e o rodapé do usuário
 * (avatar + nome + papel + Sair) embaixo. Sem estado próprio — quem decide se é
 * o painel fixo do desktop ou o drawer do mobile é o <AppLayout>.
 *
 * `onNavigate` é chamado ao clicar num link: o AppLayout usa isso para fechar o
 * drawer no mobile. No desktop é no-op.
 */
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import type { Role } from '../auth/authContext'

interface AppSidebarProps {
  userName: string
  role?: Role
  onSignOut?: () => void
  /** Chamado ao clicar num link (mobile: fecha o drawer). */
  onNavigate?: () => void
  /**
   * Admin (allowlist): enxerga TODOS os links de navegação, independentemente
   * do papel — para inspecionar as visões Aluno/Gestão/Conteúdo a partir do
   * próprio login. É só UI; RLS protege os dados.
   */
  isAdmin?: boolean
}

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  /** Match exato (para a raiz `/`, senão casaria com tudo). */
  end?: boolean
  /** Papéis que enxergam o item; ausente = todos os autenticados. */
  roles?: Role[]
}

/* Ícones inline (sem dependência): traço fino, herdam `currentColor`. */
const iconClass = 'h-5 w-5 shrink-0'

function HomeIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 10.5 12 4l9 6.5M5 9.5V20h5v-6h4v6h5V9.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function CertIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="9" r="5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="m9 13-1.5 7L12 18l4.5 2L15 13"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 2v3m0 14v3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M2 12h3m14 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PenIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20h4L18.5 9.5a2 2 0 0 0-2.8-2.8L5 17.2 4 20Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Início', icon: <HomeIcon />, end: true },
  { to: '/metas', label: 'Metas', icon: <TargetIcon /> },
  { to: '/certificados', label: 'Certificados', icon: <CertIcon /> },
  { to: '/gestor', label: 'Gestão', icon: <GearIcon />, roles: ['gestor'] },
  { to: '/autor', label: 'Conteúdo', icon: <PenIcon />, roles: ['autor'] },
]

export function AppSidebar({
  userName,
  role,
  onSignOut,
  onNavigate,
  isAdmin = false,
}: AppSidebarProps) {
  const initial = userName.trim().charAt(0).toUpperCase() || '?'
  const items = NAV_ITEMS.filter(
    (i) => !i.roles || isAdmin || (role !== undefined && i.roles.includes(role)),
  )

  return (
    <aside className="ocean-glass flex h-dvh w-64 shrink-0 flex-col border-r border-cpj-white/10">
      {/* Logo (marca oficial, versão branca para fundo escuro) */}
      <div className="flex h-16 items-center px-5">
        <img
          src="/logo-contratapj.png"
          alt="ContrataPJ Academy"
          className="h-7 w-auto"
        />
      </div>

      {/* Navegação */}
      <nav aria-label="Navegação principal" className="flex-1 space-y-1 px-3 py-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal',
                isActive
                  ? 'bg-cpj-royal/25 text-cpj-white'
                  : 'text-cpj-white/70 hover:bg-cpj-white/10 hover:text-cpj-white',
              ].join(' ')
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Rodapé do usuário */}
      <div className="border-t border-cpj-royal/15 p-3">
        <div className="flex items-center gap-3 px-2 py-1">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cpj-royal text-sm font-semibold text-cpj-white"
          >
            {initial}
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-medium text-cpj-white">
              {userName}
            </div>
            {role && (
              <div className="text-xs capitalize text-cpj-white/50">{role}</div>
            )}
          </div>
        </div>
        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-cpj-white/70 transition hover:bg-cpj-white/10 hover:text-cpj-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal"
          >
            Sair
          </button>
        )}
      </div>
    </aside>
  )
}
