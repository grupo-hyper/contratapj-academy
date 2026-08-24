/**
 * Testes do LessonVideo (Task 3.3): iframe quando há id, placeholder quando não.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LessonVideo } from './LessonVideo'

describe('LessonVideo', () => {
  it('renderiza o iframe do embed quando há youtubeId', () => {
    const { container } = render(<LessonVideo youtubeId="xyz789" title="Aula 1" />)
    const iframe = container.querySelector('iframe')
    expect(iframe).toBeTruthy()
    expect(iframe?.getAttribute('src')).toBe(
      'https://www.youtube-nocookie.com/embed/xyz789',
    )
    expect(iframe?.getAttribute('title')).toBe('Aula 1')
  })

  it('renderiza placeholder "em breve" quando não há youtubeId', () => {
    render(<LessonVideo youtubeId={null} title="Aula 1" />)
    expect(screen.getByLabelText(/vídeo em breve/i)).toBeInTheDocument()
  })
})
