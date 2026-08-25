import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppSidebar } from './AppSidebar'
import type { Role } from '../auth/authContext'

/**
 * AppSidebar — menu lateral (presentational). Testes comportamentais: wordmark,
 * links base, links por papel (RBAC visual), nome do usuário e ação de sair.
 * NavLink exige um Router no contexto, por isso o MemoryRouter.
 */
function renderSidebar(
  props: Partial<{
    userName: string
    role: Role
    onSignOut: () => void
    onNavigate: () => void
    isAdmin: boolean
  }> = {},
) {
  return render(
    <MemoryRouter>
      <AppSidebar userName="Diego" role="aluno" {...props} />
    </MemoryRouter>,
  )
}

describe('AppSidebar', () => {
  it('renderiza o wordmark e os links base', () => {
    renderSidebar()
    expect(screen.getByText('ContrataPJ')).toBeInTheDocument()
    expect(screen.getByText('Academy')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /início/i })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.getByRole('link', { name: /certificados/i })).toHaveAttribute(
      'href',
      '/certificados',
    )
  })

  it('mostra o nome do usuário', () => {
    renderSidebar({ userName: 'Diego' })
    expect(screen.getByText('Diego')).toBeInTheDocument()
  })

  it('NÃO mostra o link de gestão para aluno', () => {
    renderSidebar({ role: 'aluno' })
    expect(screen.queryByRole('link', { name: /gest/i })).not.toBeInTheDocument()
  })

  it('mostra o link de gestão só para gestor', () => {
    renderSidebar({ role: 'gestor' })
    expect(screen.getByRole('link', { name: /gest/i })).toHaveAttribute(
      'href',
      '/gestor',
    )
  })

  it('mostra o link de conteúdo só para autor', () => {
    renderSidebar({ role: 'autor' })
    expect(screen.getByRole('link', { name: /conteúdo/i })).toHaveAttribute(
      'href',
      '/autor',
    )
  })

  it('admin enxerga TODOS os links mesmo sendo aluno', () => {
    renderSidebar({ role: 'aluno', isAdmin: true })
    expect(screen.getByRole('link', { name: /gest/i })).toHaveAttribute(
      'href',
      '/gestor',
    )
    expect(screen.getByRole('link', { name: /conteúdo/i })).toHaveAttribute(
      'href',
      '/autor',
    )
  })

  it('NÃO mostra o botão Sair quando onSignOut é omitido', () => {
    renderSidebar()
    expect(
      screen.queryByRole('button', { name: /sair/i }),
    ).not.toBeInTheDocument()
  })

  it('mostra e dispara Sair quando onSignOut é informado', () => {
    const onSignOut = vi.fn()
    renderSidebar({ onSignOut })
    screen.getByRole('button', { name: /sair/i }).click()
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it('chama onNavigate ao clicar num link (fecha o drawer no mobile)', () => {
    const onNavigate = vi.fn()
    renderSidebar({ onNavigate })
    screen.getByRole('link', { name: /início/i }).click()
    expect(onNavigate).toHaveBeenCalled()
  })
})
