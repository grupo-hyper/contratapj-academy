import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

// Auth mockado: aluno logado (o AppLayout lê nome/papel/signOut daqui).
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'ana@contratapj.com.br' },
    profile: { id: 'u1', nome: 'Ana', role: 'aluno', avatar_url: null },
    loading: false,
    signOut: vi.fn(),
  }),
}))

// Importa depois do mock.
const { AppLayout } = await import('./AppLayout')

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<div>Conteúdo da Home</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppLayout', () => {
  it('renderiza a sidebar e o conteúdo da rota (Outlet)', () => {
    renderLayout()
    expect(screen.getByText('Conteúdo da Home')).toBeInTheDocument()
    // Wordmark da sidebar presente (pelo menos o painel do desktop).
    expect(screen.getAllByText('ContrataPJ').length).toBeGreaterThan(0)
  })

  it('abre o drawer no mobile ao clicar no hambúrguer', () => {
    renderLayout()
    const btn = screen.getByRole('button', { name: /abrir menu/i })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(btn)
    expect(
      screen.getByRole('button', { name: /abrir menu/i }),
    ).toHaveAttribute('aria-expanded', 'true')
  })
})
