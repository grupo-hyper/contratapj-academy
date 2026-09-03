/**
 * AuthorPage: compõe árvore + editor (módulo OU aula) + mutations (F2).
 * Mockamos useAuthorTree (dados), useAuthorMutations (spies), e os dois editores
 * (para dirigir onDirtyChange e identificar qual está aberto).
 *
 * Testes-chave: seleção abre o editor certo; trocar com alterações pendentes
 * pede confirmação; excluir pede confirmação e chama a mutation; reordenar acha
 * o vizinho e dispara o swap.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Lesson, Module } from '../../types/content'

const modules: Module[] = [
  { id: 'm1', ordem: 1, titulo: 'Mod 1', descricao: null, capa_url: null, publicado: true, created_at: 't' },
  { id: 'm2', ordem: 2, titulo: 'Mod 2', descricao: null, capa_url: null, publicado: false, created_at: 't' },
]
const lessonsByModule: Record<string, Lesson[]> = {
  m1: [
    { id: 'l1', module_id: 'm1', ordem: 1, titulo: 'Aula A', texto_md: null, youtube_id: null, duracao_seg: null, publicado: true, created_at: 't' },
    { id: 'l2', module_id: 'm1', ordem: 2, titulo: 'Aula B', texto_md: null, youtube_id: null, duracao_seg: null, publicado: false, created_at: 't' },
  ],
  m2: [],
}
let treeState = { modules, lessonsByModule, isLoading: false, isError: false, error: null as unknown }
vi.mock('./useAuthorTree', () => ({ useAuthorTree: () => treeState }))

const mut = {
  createModule: vi.fn(),
  updateModule: vi.fn(),
  deleteModule: vi.fn(),
  createLesson: vi.fn(),
  deleteLesson: vi.fn(),
  reorderModules: vi.fn(),
  reorderLessons: vi.fn(),
  isMutating: false,
  isMutationError: false,
}
vi.mock('./useAuthorMutations', () => ({ useAuthorMutations: () => mut }))

// Editores stub: mostram o id e sujam o form via onDirtyChange.
vi.mock('./LessonEditor', () => ({
  LessonEditor: ({ lesson, onDirtyChange }: { lesson: Lesson; onDirtyChange: (d: boolean) => void }) => (
    <div>
      <span data-testid="editing-lesson">{lesson.id}</span>
      <button type="button" onClick={() => onDirtyChange(true)}>sujar</button>
    </div>
  ),
}))
vi.mock('./ModuleEditor', () => ({
  ModuleEditor: ({ module, onDirtyChange }: { module: Module; onDirtyChange: (d: boolean) => void }) => (
    <div>
      <span data-testid="editing-module">{module.id}</span>
      <button type="button" onClick={() => onDirtyChange(true)}>sujar</button>
    </div>
  ),
}))
// QuizEditor stub: mostra o moduleId do quiz aberto (o real usaria supabase).
vi.mock('./QuizEditor', () => ({
  QuizEditor: ({ moduleId }: { moduleId: string }) => (
    <span data-testid="editing-quiz">{moduleId}</span>
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
    expect(screen.getByText(/selecione um módulo/i)).toBeInTheDocument()
  })

  it('selecionar uma aula abre o LessonEditor dela', () => {
    render(<AuthorPage />)
    fireEvent.click(screen.getByRole('button', { name: /^\d+\.Aula A$/ }))
    expect(screen.getByTestId('editing-lesson')).toHaveTextContent('l1')
  })

  it('selecionar um módulo abre o ModuleEditor dele', () => {
    render(<AuthorPage />)
    fireEvent.click(screen.getByRole('button', { name: /^\d+\.Mod 1$/ }))
    expect(screen.getByTestId('editing-module')).toHaveTextContent('m1')
  })

  it('selecionar o quiz de um módulo abre o QuizEditor dele', () => {
    render(<AuthorPage />)
    // O 1º "Quiz do módulo" pertence ao m1.
    fireEvent.click(screen.getAllByRole('button', { name: /Quiz do módulo/ })[0])
    expect(screen.getByTestId('editing-quiz')).toHaveTextContent('m1')
  })

  it('trocar de aula com alterações pendentes pede confirmação e respeita o cancelar', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<AuthorPage />)
    fireEvent.click(screen.getByRole('button', { name: /^\d+\.Aula A$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'sujar' }))
    fireEvent.click(screen.getByRole('button', { name: /^\d+\.Aula B/ }))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('editing-lesson')).toHaveTextContent('l1')
  })

  it('troca quando o usuário confirma o descarte', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<AuthorPage />)
    fireEvent.click(screen.getByRole('button', { name: /^\d+\.Aula A$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'sujar' }))
    fireEvent.click(screen.getByRole('button', { name: /^\d+\.Aula B/ }))
    expect(screen.getByTestId('editing-lesson')).toHaveTextContent('l2')
  })

  it('novo módulo chama createModule', () => {
    render(<AuthorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Novo módulo/ }))
    expect(mut.createModule).toHaveBeenCalledTimes(1)
  })

  it('excluir módulo pede confirmação e chama deleteModule', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<AuthorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Excluir módulo Mod 1/ }))
    expect(mut.deleteModule).toHaveBeenCalledWith('m1')
  })

  it('excluir aula cancelado não chama deleteLesson', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<AuthorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Excluir aula Aula A/ }))
    expect(mut.deleteLesson).not.toHaveBeenCalled()
  })

  it('descer o módulo m1 faz swap com o vizinho m2', () => {
    render(<AuthorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Mover módulo Mod 1 para baixo/ }))
    expect(mut.reorderModules).toHaveBeenCalledWith(
      { id: 'm1', ordem: 1 },
      { id: 'm2', ordem: 2 },
    )
  })

  it('subir a aula l2 faz swap com a vizinha l1', () => {
    render(<AuthorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Mover aula Aula B para cima/ }))
    expect(mut.reorderLessons).toHaveBeenCalledWith(
      { id: 'l2', ordem: 2 },
      { id: 'l1', ordem: 1 },
    )
  })
})
