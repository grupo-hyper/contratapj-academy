import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Lesson, Module } from '../../types/content'
import { AuthorTree } from './AuthorTree'

const modules: Module[] = [
  { id: 'm1', ordem: 1, titulo: 'Fundamentos', descricao: null, capa_url: null, publicado: true, created_at: 't' },
  { id: 'm2', ordem: 2, titulo: 'Avançado', descricao: null, capa_url: null, publicado: false, created_at: 't' },
]
const lessonsByModule: Record<string, Lesson[]> = {
  m1: [
    { id: 'l1', module_id: 'm1', ordem: 1, titulo: 'Aula A', texto_md: null, youtube_id: null, duracao_seg: null, publicado: true, created_at: 't' },
    { id: 'l2', module_id: 'm1', ordem: 2, titulo: 'Aula B', texto_md: null, youtube_id: null, duracao_seg: null, publicado: false, created_at: 't' },
  ],
  m2: [],
}

describe('AuthorTree', () => {
  it('lista módulos e aulas e chama onSelectLesson ao clicar numa aula', () => {
    const onSelect = vi.fn()
    render(
      <AuthorTree
        modules={modules}
        lessonsByModule={lessonsByModule}
        selectedLessonId={null}
        onSelectLesson={onSelect}
      />,
    )
    expect(screen.getByText('Fundamentos')).toBeInTheDocument()
    expect(screen.getByText('Avançado')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Aula B/ }))
    expect(onSelect).toHaveBeenCalledWith('l2')
  })

  it('marca a aula selecionada com aria-current', () => {
    render(
      <AuthorTree
        modules={modules}
        lessonsByModule={lessonsByModule}
        selectedLessonId="l1"
        onSelectLesson={vi.fn()}
      />,
    )
    const selected = screen.getByRole('button', { name: /Aula A/ })
    expect(selected).toHaveAttribute('aria-current', 'true')
  })
})
