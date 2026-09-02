/**
 * LessonEditor: edita título/YouTube/texto/publicado, mostra "alterações não
 * salvas" quando sujo, salva via useSaveLesson e exibe erro inline na falha.
 * Mockamos useSaveLesson (não o supabase) para dirigir sucesso/erro/estado.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Lesson } from '../../types/content'

const saveMock = vi.fn()
let saveState = {
  save: saveMock,
  isSaving: false,
  isError: false,
  isSuccess: false,
  error: null as unknown,
  reset: vi.fn(),
}
vi.mock('./useSaveLesson', () => ({
  useSaveLesson: () => saveState,
}))
// Preview não é o foco aqui; stub simples evita depender do render de markdown.
vi.mock('../lesson/LessonSlides', () => ({
  LessonSlides: ({ markdown }: { markdown: string | null }) => (
    <div data-testid="preview">{markdown}</div>
  ),
}))

import { LessonEditor } from './LessonEditor'

const lesson: Lesson = {
  id: 'l1',
  module_id: 'm1',
  ordem: 1,
  titulo: 'Abertura',
  texto_md: '## 1. Oi\ncorpo',
  youtube_id: 'abc',
  duracao_seg: null,
  publicado: false,
  created_at: 't',
}

afterEach(() => {
  vi.clearAllMocks()
  saveState = { save: saveMock, isSaving: false, isError: false, isSuccess: false, error: null, reset: vi.fn() }
})

describe('LessonEditor', () => {
  it('Salvar começa desabilitado (sem alterações) e habilita ao editar', () => {
    render(<LessonEditor lesson={lesson} onDirtyChange={vi.fn()} />)
    const salvar = screen.getByRole('button', { name: /Salvar/ })
    expect(salvar).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Título/), {
      target: { value: 'Abertura!' },
    })
    expect(salvar).toBeEnabled()
    expect(screen.getByText(/alterações não salvas/i)).toBeInTheDocument()
  })

  it('ao salvar, chama save com id e patch normalizado', () => {
    render(<LessonEditor lesson={lesson} onDirtyChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/YouTube/), {
      target: { value: '  ' }, // vira null
    })
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }))
    expect(saveMock).toHaveBeenCalledWith({
      id: 'l1',
      patch: { titulo: 'Abertura', youtube_id: null, texto_md: '## 1. Oi\ncorpo', publicado: false },
    })
  })

  it('mostra erro inline quando isError', () => {
    saveState = { ...saveState, isError: true, error: new Error('RLS') }
    render(<LessonEditor lesson={lesson} onDirtyChange={vi.fn()} />)
    expect(screen.getByText(/não foi possível salvar/i)).toBeInTheDocument()
  })

  it('reflete o texto no preview conforme edita o textarea', () => {
    render(<LessonEditor lesson={lesson} onDirtyChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/Conteúdo/), {
      target: { value: '## 1. Novo\nx' },
    })
    expect(screen.getByTestId('preview')).toHaveTextContent('## 1. Novo')
  })
})
