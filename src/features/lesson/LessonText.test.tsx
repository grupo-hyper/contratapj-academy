/**
 * Testes do LessonText (Task 3.3): renderiza markdown (heading + lista) e trata
 * conteúdo vazio graciosamente.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LessonText } from './LessonText'

describe('LessonText', () => {
  it('renderiza heading e itens de lista do markdown', () => {
    render(
      <LessonText markdown={'# Título da aula\n\n- Primeiro item\n- Segundo item'} />,
    )
    expect(
      screen.getByRole('heading', { name: /Título da aula/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Primeiro item')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('trata markdown nulo/vazio graciosamente', () => {
    render(<LessonText markdown={null} />)
    expect(screen.getByText(/ainda não tem material em texto/i)).toBeInTheDocument()
  })
})
