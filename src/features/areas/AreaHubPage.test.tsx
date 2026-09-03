/**
 * Teste de aceite da AreaHubPage (Task 4, Fase 1 de Áreas): hub de áreas que
 * ocupará a rota `/`. Renderiza o grid de `<AreaCard>` a partir de
 * `useAreas`, com estados de loading/erro/vazio.
 *
 * Estratégia: mockamos a CAMADA DE DADOS (`useAreas`), renderizando a
 * COMPOSIÇÃO real (inclui `AreaCard`, que usa `<Link>` — por isso o
 * `MemoryRouter`). Mesmo padrão de `CertificatesPage.test.tsx`.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { Area } from '../../types/content'

const useAreasMock = vi.fn()
vi.mock('./useAreas', () => ({
  useAreas: (...a: unknown[]) => useAreasMock(...a),
}))

import { AreaHubPage } from './AreaHubPage'

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

function setHook(overrides: Record<string, unknown> = {}) {
  useAreasMock.mockReturnValue({
    areas: [],
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  })
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AreaHubPage />
    </MemoryRouter>,
  )
}

describe('AreaHubPage', () => {
  it('renderiza 2 AreaCards quando o hook devolve 2 áreas', () => {
    setHook({
      areas: [
        makeArea({ id: 'area-1', nome: 'Comercial', slug: 'comercial' }),
        makeArea({ id: 'area-2', nome: 'Marketing', slug: 'marketing' }),
      ],
    })
    renderPage()

    expect(screen.getByText('Comercial')).toBeInTheDocument()
    expect(screen.getByText('Marketing')).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('mostra "Nenhuma área publicada." quando o hook devolve vazio', () => {
    setHook({ areas: [] })
    renderPage()

    expect(screen.getByText('Nenhuma área publicada.')).toBeInTheDocument()
  })

  it('mostra o skeleton de loading enquanto isLoading', () => {
    setHook({ areas: [], isLoading: true })
    const { container } = renderPage()

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    expect(screen.queryByText('Nenhuma área publicada.')).not.toBeInTheDocument()
  })

  it('mostra mensagem de erro quando isError', () => {
    setHook({ areas: [], isError: true })
    renderPage()

    expect(
      screen.getByText('Não foi possível carregar as áreas.'),
    ).toBeInTheDocument()
  })
})
