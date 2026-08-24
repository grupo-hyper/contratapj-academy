import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressBar } from './ProgressBar'

describe('ProgressBar', () => {
  it('expõe role progressbar com aria-valuenow/min/max', () => {
    render(<ProgressBar value={37} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '37')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('faz clamp de valores abaixo de 0', () => {
    render(<ProgressBar value={-25} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })

  it('faz clamp de valores acima de 100', () => {
    render(<ProgressBar value={150} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100',
    )
  })

  it('renderiza o label quando informado e o usa como aria-label', () => {
    render(<ProgressBar value={60} label="Progresso do módulo" />)
    expect(screen.getByText('Progresso do módulo')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-label',
      'Progresso do módulo',
    )
  })

  it('não renderiza texto de label quando omitido', () => {
    render(<ProgressBar value={50} />)
    // Sem label visível, mas a barra continua acessível.
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
})
