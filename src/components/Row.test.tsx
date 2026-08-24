import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Row } from './Row'

describe('Row', () => {
  it('renderiza o título', () => {
    render(
      <Row title="Continue assistindo">
        <button type="button">Tile A</button>
      </Row>,
    )
    expect(
      screen.getByRole('heading', { name: 'Continue assistindo' }),
    ).toBeInTheDocument()
  })

  it('envolve cada child num listitem (semântica list/listitem válida)', () => {
    render(
      <Row title="Módulos">
        <button type="button">Tile A</button>
        <button type="button">Tile B</button>
      </Row>,
    )
    expect(screen.getByRole('list')).toBeInTheDocument()
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
  })
})
