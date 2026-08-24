import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Tile } from './Tile'

describe('Tile', () => {
  it('renderiza o título e o subtítulo', () => {
    render(<Tile title="Prospecção fria" subtitle="Módulo 1" state="current" />)
    expect(screen.getByText('Prospecção fria')).toBeInTheDocument()
    expect(screen.getByText('Módulo 1')).toBeInTheDocument()
  })

  it('estado "current": é acionável e dispara onClick', async () => {
    const onClick = vi.fn()
    render(<Tile title="Aula ativa" state="current" onClick={onClick} />)
    const btn = screen.getByRole('button', { name: /aula ativa/i })
    expect(btn).not.toBeDisabled()
    btn.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('estado "done": é acionável, dispara onClick e mostra indicador de concluído', () => {
    const onClick = vi.fn()
    render(<Tile title="Aula feita" state="done" onClick={onClick} />)
    const btn = screen.getByRole('button', { name: /aula feita/i })
    expect(btn).not.toBeDisabled()
    btn.click()
    expect(onClick).toHaveBeenCalledTimes(1)
    // Indicador acessível de concluído.
    expect(screen.getByLabelText(/concluíd/i)).toBeInTheDocument()
  })

  it('estado "locked": não-acionável mas focável (descobrível por teclado/AT)', () => {
    const onClick = vi.fn()
    render(<Tile title="Aula bloqueada" state="locked" onClick={onClick} />)
    const el = screen.getByRole('button', { name: /aula bloqueada/i })
    expect(el).toHaveAttribute('aria-disabled', 'true')
    // Permanece no fluxo de foco: sem `disabled` nativo e com tabIndex=0.
    expect(el).not.toBeDisabled()
    expect(el).toHaveAttribute('tabindex', '0')
    // Clicar não dispara a ação.
    el.click()
    expect(onClick).not.toHaveBeenCalled()
    // Afordância de cadeado.
    expect(screen.getByLabelText(/bloquead/i)).toBeInTheDocument()
  })

  it('mostra a barra de progresso quando progressPct é informado', () => {
    render(<Tile title="Em andamento" state="current" progressPct={42} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '42')
  })

  it('não renderiza progresso quando progressPct é omitido', () => {
    render(<Tile title="Sem progresso" state="current" />)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
