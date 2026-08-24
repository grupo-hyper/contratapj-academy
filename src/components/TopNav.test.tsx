import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TopNav } from './TopNav'

describe('TopNav', () => {
  it('renderiza o wordmark e o nome do usuário', () => {
    render(<TopNav userName="Diego" role="gestor" />)
    expect(screen.getByText('ContrataPJ')).toBeInTheDocument()
    expect(screen.getByText('Academy')).toBeInTheDocument()
    expect(screen.getByText('Diego')).toBeInTheDocument()
  })

  it('NÃO mostra o botão Sair quando onSignOut é omitido', () => {
    render(<TopNav userName="Diego" />)
    expect(
      screen.queryByRole('button', { name: /sair/i }),
    ).not.toBeInTheDocument()
  })

  it('mostra e dispara o botão Sair quando onSignOut é informado', () => {
    const onSignOut = vi.fn()
    render(<TopNav userName="Diego" onSignOut={onSignOut} />)
    const btn = screen.getByRole('button', { name: /sair/i })
    expect(btn).toBeInTheDocument()
    btn.click()
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })
})
