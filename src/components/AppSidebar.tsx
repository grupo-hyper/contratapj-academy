/**
 * AppSidebar - menu lateral (Editorial Noir), presentational.
 *
 * Wordmark no topo, links de navegacao (estado ativo via NavLink) no meio, e o
 * rodape do usuario (avatar + nome + papel + Sair) embaixo. Sem estado proprio:
 * quem decide se e painel fixo (desktop) ou drawer (mobile) e o <AppLayout>.
 *
 * `onNavigate` e chamado ao clicar num link: o AppLayout usa isso para fechar o
 * drawer no mobile. No desktop e no-op.
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
   * Admin (allowlist): enxerga TODOS os links, independentemente do papel,
   * para inspecionar as visoes Aluno/Gestao/Conteudo. E so UI; RLS protege os
   * dados.
   */
  isAdmin?: boolean
}

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  /** Match exato (para a raiz `/`, senao casaria com tudo). */
  end?: boolean
  /** Papeis que enxergam o item; ausente = todos os autenticados. */
  roles?: Role[]
}

const iconClass = 'h-5 w-5 shrink-0'

function HomeIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-8.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    </svg>
  )
}

function CertIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="9.5" r="5.3" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8.6 13.8-1.8 6 5.2-2.6 5.2 2.6-1.8-6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2v3m0 14v3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M2 12h3m14 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function PenIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20h4L18.5 9.5a2 2 0 0 0-2.8-2.8L5 17.2 4 20Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
    <aside className="en-side" aria-label="Navegação principal">
      <div className="en-brand" role="img" aria-label="ContrataPJ Academy">
        <span className="en-brandmark" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M17.5 7.2A6.4 6.4 0 1 0 17.6 16.9" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            <circle cx="18.6" cy="12" r="2.1" fill="#DE5968" />
          </svg>
        </span>
        <div className="en-brandname">
          ContrataPJ<em>Academy</em>
        </div>
      </div>

      <nav className="en-nav" aria-label="Seções">
        <span className="en-navlabel">Menu</span>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) => (isActive ? 'en-active' : undefined)}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="en-sidefoot">
        <div className="en-user">
          <span className="en-avatar" aria-hidden="true">
            {initial}
          </span>
          <div>
            <b>{userName}</b>
            {(isAdmin || role) && <span>{isAdmin ? 'Admin' : role}</span>}
          </div>
        </div>
        {onSignOut && (
          <button type="button" className="en-logout" onClick={onSignOut}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M15 8l4 4-4 4M19 12H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sair
          </button>
        )}
      </div>
    </aside>
  )
}
