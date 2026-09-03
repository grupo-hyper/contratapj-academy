/**
 * Teste de aceite do AreaCard (Task 3, Fase 1 de Áreas): componente
 * presentational que renderiza uma `Area` como link de navegação.
 *
 * Estratégia: render direto (sem mocks — o componente não busca dados),
 * envolto em `MemoryRouter` porque `AreaCard` usa `<Link>` do
 * react-router-dom.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { Area } from '../../types/content'
import { AreaCard } from './AreaCard'

function makeArea(overrides: Partial<Area> = {}): Area {
  return {
    id: 'area-1',
    nome: 'Comercial',
    slug: 'comercial',
    descricao: 'Playbooks do time comercial',
    capa_url: null,
    visibilidade: 'publica',
    ordem: 1,
    publicado: true,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderCard(area: Area) {
  return render(
    <MemoryRouter>
      <AreaCard area={area} />
    </MemoryRouter>,
  )
}

describe('AreaCard', () => {
  it('renderiza o nome da área', () => {
    renderCard(makeArea({ nome: 'Comercial' }))

    expect(screen.getByText('Comercial')).toBeInTheDocument()
  })

  it('renderiza um link para /area/<slug>', () => {
    renderCard(makeArea({ slug: 'comercial' }))

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/area/comercial')
  })

  it('sem capa, mostra a inicial do nome como fallback', () => {
    const { container } = renderCard(
      makeArea({ nome: 'Comercial', capa_url: null }),
    )

    expect(container.querySelector('img')).not.toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
  })

  it('com capa, renderiza a imagem', () => {
    const { container } = renderCard(
      makeArea({ capa_url: 'https://cdn.example.com/comercial.jpg' }),
    )

    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/comercial.jpg')
  })

  it('renderiza a descrição quando presente', () => {
    renderCard(makeArea({ descricao: 'Playbooks do time comercial' }))

    expect(
      screen.getByText('Playbooks do time comercial'),
    ).toBeInTheDocument()
  })

  it('não quebra quando a descrição é null', () => {
    renderCard(makeArea({ descricao: null }))

    expect(screen.getByRole('link')).toBeInTheDocument()
  })
})
