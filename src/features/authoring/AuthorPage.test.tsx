/**
 * AuthorPage: compõe árvore + editor. Testes-chave: seleção abre o editor; e
 * trocar de aula COM alterações pendentes pede confirmação (window.confirm).
 * Mockamos useAuthorTree (dados) e LessonEditor (para dirigir onDirtyChange).
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Lesson, Module } from '../../types/content'

const modules: Module[] = [
  { id: 'm1', ordem: 1, titulo: 'Mod 1', descricao: null, capa_url: null, publicado: true, created_at: 't' },
]
const lessonsByModule: Record<string, Lesson[]> = {
  m1: [
    { id: 'l1', module_id: 'm1', ordem: 1, titulo: 'Aula A', texto_md: null, youtube_id: null, duracao_seg: null, publicado: true, created_at: 't' },
    { id: 'l2', module_id: 'm1', ordem: 2, titulo: 'Aula B', texto_md: null, youtube_id: null, duracao_seg: null, publicado: false, created_at: 't' },
  ],
}
let treeState = { modules, lessonsByModule, isLoading: false, isError: false, error: null as unknown }
vi.mock('./useAuthorTree', () => ({ useAuthorTree: () => treeState }))

// Editor stub: mostra o id da aula e um botão que "suja" o form via onDirtyChange.
vi.mock('./LessonEditor', () => ({
  LessonEditor: ({ lesson, onDirtyChange }: { lesson: Lesson; onDirtyChange: (d: boolean) => void }) => (
    <div>
      <span data-testid="editing">{lesson.id}</span>
      <button type="button" onClick={() => onDirtyChange(true)}>sujar</button>
    </div>
  ),
}))

import { AuthorPage } from './AuthorPage'

afterEach(() => {
  vi.clearAllMocks()
  treeState = { modules, lessonsByModule, isLoading: false, isError: false, error: null }
})

describe('AuthorPage', () => {
  it('sem seleção mostra o placeholder', () => {
    render(<AuthorPage />)
    expect(screen.getByText(/selecione uma aula/i)).toBeInTheDocument()
  })

  it('selecionar uma aula abre o editor dela', () => {
    render(<AuthorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Aula A/ }))
    expect(screen.getByTestId('editing')).toHaveTextContent('l1')
  })

  it('trocar de aula com alterações pendentes pede confirmação e respeita o "cancelar"', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<AuthorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Aula A/ }))
    // Suja o editor da Aula A.
    fireEvent.click(screen.getByRole('button', { name: 'sujar' }))
    // Tenta ir para a Aula B: confirm retorna false → permanece em l1.
    fireEvent.click(screen.getByRole('button', { name: /Aula B/ }))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('editing')).toHaveTextContent('l1')
  })

  it('troca quando o usuário confirma o descarte', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<AuthorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Aula A/ }))
    fireEvent.click(screen.getByRole('button', { name: 'sujar' }))
    fireEvent.click(screen.getByRole('button', { name: /Aula B/ }))
    expect(screen.getByTestId('editing')).toHaveTextContent('l2')
  })
})
