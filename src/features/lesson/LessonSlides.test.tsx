/**
 * Testes do LessonSlides: navegação por slides, "Próximo" bloqueado por 10s a
 * cada slide, "Anterior" imediato, e casos de 0/1 seção.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LessonSlides } from './LessonSlides'

const MD = ['## 1. Um\nprimeiro', '## 2. Dois\nsegundo', '## 3. Três\nterceiro'].join(
  '\n\n',
)

describe('LessonSlides', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('mostra o primeiro slide e o contador, com "Próximo" bloqueado', () => {
    render(<LessonSlides markdown={MD} />)
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Um/ })).toBeInTheDocument()

    const next = screen.getByRole('button', { name: /Próximo em \d+s/ })
    expect(next).toBeDisabled()
  })

  it('libera "Próximo" após 10s e avança de slide', () => {
    render(<LessonSlides markdown={MD} />)
    act(() => vi.advanceTimersByTime(5_000))

    const next = screen.getByRole('button', { name: 'Próximo →' })
    expect(next).toBeEnabled()

    fireEvent.click(next)
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
    // Ao entrar no novo slide, o gate re-arma (bloqueado de novo).
    expect(
      screen.getByRole('button', { name: /Próximo em \d+s/ }),
    ).toBeDisabled()
  })

  it('"Anterior" é imediato (sem esperar os 10s)', () => {
    render(<LessonSlides markdown={MD} />)
    // Avança para o slide 2.
    act(() => vi.advanceTimersByTime(5_000))
    fireEvent.click(screen.getByRole('button', { name: 'Próximo →' }))
    expect(screen.getByText('2 / 3')).toBeInTheDocument()

    // Volta sem avançar o relógio: deve funcionar na hora.
    const prev = screen.getByRole('button', { name: /Anterior/ })
    expect(prev).toBeEnabled()
    fireEvent.click(prev)
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('"Anterior" fica desabilitado no primeiro slide', () => {
    render(<LessonSlides markdown={MD} />)
    expect(screen.getByRole('button', { name: /Anterior/ })).toBeDisabled()
  })

  it('uma seção só → sem navegação', () => {
    render(<LessonSlides markdown={'## 1. Única\nconteúdo'} />)
    expect(screen.queryByText(/\/ 1/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Próximo/ }),
    ).not.toBeInTheDocument()
  })

  it('markdown vazio → mensagem de sem material', () => {
    render(<LessonSlides markdown={null} />)
    expect(
      screen.getByText(/ainda não tem material em texto/i),
    ).toBeInTheDocument()
  })

  it('gated=false libera "Próximo" imediatamente (preview do autor)', () => {
    render(<LessonSlides markdown={MD} gated={false} />)
    // Sem avançar o relógio: o botão já deve estar habilitado e sem contagem.
    const next = screen.getByRole('button', { name: 'Próximo →' })
    expect(next).toBeEnabled()
    fireEvent.click(next)
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
    // No slide seguinte continua livre (sem re-armar o gate).
    expect(screen.getByRole('button', { name: 'Próximo →' })).toBeEnabled()
  })
})
