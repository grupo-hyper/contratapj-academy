/**
 * QuizEditor (F3): renderiza perguntas + alternativas e chama as mutations do
 * useModuleQuiz (mockado com spies). Cobre: render, criar pergunta, marcar a
 * correta (setCorrectOption com questionId+optionId), e excluir com confirm.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const hook = {
  questions: [
    {
      id: 'q1',
      enunciado: 'Qual é a alíquota?',
      options: [
        { id: 'o1', texto: 'A', correta: true },
        { id: 'o2', texto: 'B', correta: false },
      ],
    },
  ],
  isLoading: false,
  isError: false,
  createQuestion: vi.fn(),
  updateQuestion: vi.fn(),
  deleteQuestion: vi.fn(),
  createOption: vi.fn(),
  updateOptionText: vi.fn(),
  deleteOption: vi.fn(),
  setCorrectOption: vi.fn(),
  isMutating: false,
  isMutationError: false,
}
vi.mock('./useModuleQuiz', () => ({ useModuleQuiz: () => hook }))

import { QuizEditor } from './QuizEditor'

afterEach(() => {
  vi.clearAllMocks()
})

describe('QuizEditor', () => {
  it('renderiza perguntas e alternativas', () => {
    render(<QuizEditor moduleId="m1" moduleTitle="Fundamentos" />)
    expect(screen.getByDisplayValue('Qual é a alíquota?')).toBeInTheDocument()
    expect(screen.getByDisplayValue('A')).toBeInTheDocument()
    expect(screen.getByDisplayValue('B')).toBeInTheDocument()
    // A alternativa correta está marcada.
    const radioA = screen.getByRole('radio', {
      name: /Marcar "A" como correta/,
    })
    expect(radioA).toBeChecked()
  })

  it('criar pergunta chama createQuestion', () => {
    render(<QuizEditor moduleId="m1" />)
    fireEvent.click(screen.getByRole('button', { name: /Nova pergunta/ }))
    expect(hook.createQuestion).toHaveBeenCalledTimes(1)
  })

  it('marcar a correta chama setCorrectOption com (questionId, optionId)', () => {
    render(<QuizEditor moduleId="m1" />)
    fireEvent.click(
      screen.getByRole('radio', { name: /Marcar "B" como correta/ }),
    )
    expect(hook.setCorrectOption).toHaveBeenCalledWith('q1', 'o2')
  })

  it('excluir pergunta pede confirm e chama deleteQuestion', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<QuizEditor moduleId="m1" />)
    fireEvent.click(screen.getByRole('button', { name: /Excluir pergunta 1/ }))
    expect(hook.deleteQuestion).toHaveBeenCalledWith('q1')
  })

  it('excluir pergunta cancelado NÃO chama deleteQuestion', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<QuizEditor moduleId="m1" />)
    fireEvent.click(screen.getByRole('button', { name: /Excluir pergunta 1/ }))
    expect(hook.deleteQuestion).not.toHaveBeenCalled()
  })
})
