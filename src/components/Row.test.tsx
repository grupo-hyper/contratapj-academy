import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Row } from './Row'

/** Simula as dimensões de scroll que o jsdom não calcula (layout real). */
function mockScrollDims(
  el: HTMLElement,
  { scrollWidth, clientWidth, scrollLeft }: { scrollWidth: number; clientWidth: number; scrollLeft: number },
) {
  Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true })
  Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true })
  Object.defineProperty(el, 'scrollLeft', { value: scrollLeft, configurable: true, writable: true })
}

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

  it('não renderiza setas quando o conteúdo cabe sem rolagem', () => {
    render(
      <Row title="Módulos">
        <button type="button">Tile A</button>
      </Row>,
    )
    expect(screen.queryByLabelText('Rolar para a esquerda')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Rolar para a direita')).not.toBeInTheDocument()
  })

  it('renderiza só a seta direita quando há overflow e o scroll está no início', () => {
    render(
      <Row title="Módulos">
        <button type="button">Tile A</button>
      </Row>,
    )
    const list = screen.getByRole('list')
    mockScrollDims(list, { scrollWidth: 1000, clientWidth: 400, scrollLeft: 0 })
    fireEvent.scroll(list)

    expect(screen.queryByLabelText('Rolar para a esquerda')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Rolar para a direita')).toBeInTheDocument()
  })

  it('mostra a seta esquerda depois de rolar para a direita', () => {
    render(
      <Row title="Módulos">
        <button type="button">Tile A</button>
      </Row>,
    )
    const list = screen.getByRole('list')
    mockScrollDims(list, { scrollWidth: 1000, clientWidth: 400, scrollLeft: 300 })
    fireEvent.scroll(list)

    expect(screen.getByLabelText('Rolar para a esquerda')).toBeInTheDocument()
  })

  it('esconde a seta direita quando o scroll chega ao fim', () => {
    render(
      <Row title="Módulos">
        <button type="button">Tile A</button>
      </Row>,
    )
    const list = screen.getByRole('list')
    mockScrollDims(list, { scrollWidth: 1000, clientWidth: 400, scrollLeft: 600 })
    fireEvent.scroll(list)

    expect(screen.queryByLabelText('Rolar para a direita')).not.toBeInTheDocument()
  })

  it('clicar na seta direita rola o container para a frente', () => {
    render(
      <Row title="Módulos">
        <button type="button">Tile A</button>
      </Row>,
    )
    const list = screen.getByRole('list')
    mockScrollDims(list, { scrollWidth: 1000, clientWidth: 400, scrollLeft: 0 })
    list.scrollBy = vi.fn()
    fireEvent.scroll(list)

    fireEvent.click(screen.getByLabelText('Rolar para a direita'))

    expect(list.scrollBy).toHaveBeenCalledWith({ left: 360, behavior: 'smooth' })
  })

  it('clicar na seta esquerda rola o container para trás', () => {
    render(
      <Row title="Módulos">
        <button type="button">Tile A</button>
      </Row>,
    )
    const list = screen.getByRole('list')
    mockScrollDims(list, { scrollWidth: 1000, clientWidth: 400, scrollLeft: 300 })
    list.scrollBy = vi.fn()
    fireEvent.scroll(list)

    fireEvent.click(screen.getByLabelText('Rolar para a esquerda'))

    expect(list.scrollBy).toHaveBeenCalledWith({ left: -360, behavior: 'smooth' })
  })
})
