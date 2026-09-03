import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Lesson, Module } from '../../types/content'
import { AuthorTree } from './AuthorTree'

const modules: Module[] = [
  { id: 'm1', area_id: 'a1', ordem: 1, titulo: 'Fundamentos', descricao: null, capa_url: null, publicado: true, created_at: 't' },
  { id: 'm2', area_id: 'a1', ordem: 2, titulo: 'Avançado', descricao: null, capa_url: null, publicado: false, created_at: 't' },
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

  it('clicar no módulo chama onSelectModule e marca aria-current', () => {
    const onSelectModule = vi.fn()
    render(
      <AuthorTree
        modules={modules}
        lessonsByModule={lessonsByModule}
        selectedLessonId={null}
        selectedModuleId="m2"
        onSelectLesson={vi.fn()}
        onSelectModule={onSelectModule}
      />,
    )
    const mod = screen.getByRole('button', { name: /Fundamentos/ })
    fireEvent.click(mod)
    expect(onSelectModule).toHaveBeenCalledWith('m1')
    expect(screen.getByRole('button', { name: /Avançado/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('criar módulo e criar aula chamam os callbacks certos', () => {
    const onCreateModule = vi.fn()
    const onCreateLesson = vi.fn()
    render(
      <AuthorTree
        modules={modules}
        lessonsByModule={lessonsByModule}
        selectedLessonId={null}
        onSelectLesson={vi.fn()}
        onCreateModule={onCreateModule}
        onCreateLesson={onCreateLesson}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Novo módulo/ }))
    expect(onCreateModule).toHaveBeenCalledTimes(1)
    // A primeira "+ nova aula" pertence ao módulo m1.
    fireEvent.click(screen.getAllByRole('button', { name: /nova aula/ })[0])
    expect(onCreateLesson).toHaveBeenCalledWith('m1')
  })

  it('excluir módulo/aula chamam os callbacks com o item', () => {
    const onDeleteModule = vi.fn()
    const onDeleteLesson = vi.fn()
    render(
      <AuthorTree
        modules={modules}
        lessonsByModule={lessonsByModule}
        selectedLessonId={null}
        onSelectLesson={vi.fn()}
        onDeleteModule={onDeleteModule}
        onDeleteLesson={onDeleteLesson}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Excluir módulo Fundamentos/ }))
    expect(onDeleteModule).toHaveBeenCalledWith(modules[0])
    fireEvent.click(screen.getByRole('button', { name: /Excluir aula Aula A/ }))
    expect(onDeleteLesson).toHaveBeenCalledWith(lessonsByModule.m1[0])
  })

  it('mostra "Quiz do módulo" por módulo, chama onSelectQuiz e destaca o selecionado', () => {
    const onSelectQuiz = vi.fn()
    render(
      <AuthorTree
        modules={modules}
        lessonsByModule={lessonsByModule}
        selectedLessonId={null}
        onSelectLesson={vi.fn()}
        onSelectQuiz={onSelectQuiz}
        selectedQuizModuleId="m2"
      />,
    )
    const quizButtons = screen.getAllByRole('button', {
      name: /Quiz do módulo/,
    })
    expect(quizButtons).toHaveLength(2)
    // O 1º pertence ao módulo m1.
    fireEvent.click(quizButtons[0])
    expect(onSelectQuiz).toHaveBeenCalledWith('m1')
    // O quiz do m2 está destacado (aria-current).
    expect(quizButtons[1]).toHaveAttribute('aria-current', 'true')
  })

  it('setas ↑↓ reordenam e ficam desabilitadas nas pontas', () => {
    const onReorderModule = vi.fn()
    const onReorderLesson = vi.fn()
    render(
      <AuthorTree
        modules={modules}
        lessonsByModule={lessonsByModule}
        selectedLessonId={null}
        onSelectLesson={vi.fn()}
        onReorderModule={onReorderModule}
        onReorderLesson={onReorderLesson}
      />,
    )
    // ↑ do primeiro módulo está desabilitado; ↓ dele desce (dir +1).
    const upM1 = screen.getByRole('button', { name: /Mover módulo Fundamentos para cima/ })
    const downM1 = screen.getByRole('button', { name: /Mover módulo Fundamentos para baixo/ })
    expect(upM1).toBeDisabled()
    fireEvent.click(downM1)
    expect(onReorderModule).toHaveBeenCalledWith(modules[0], 1)

    // ↓ da última aula (Aula B) está desabilitada; ↑ dela sobe (dir -1).
    const downLB = screen.getByRole('button', { name: /Mover aula Aula B para baixo/ })
    const upLB = screen.getByRole('button', { name: /Mover aula Aula B para cima/ })
    expect(downLB).toBeDisabled()
    fireEvent.click(upLB)
    expect(onReorderLesson).toHaveBeenCalledWith(lessonsByModule.m1[1], -1)
  })
})
