import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CourseGlyph } from './CourseGlyph'

describe('CourseGlyph', () => {
  it('renderiza um SVG decorativo (aria-hidden, não anunciado por leitores)', () => {
    const { container } = render(<CourseGlyph order={1} />)
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('escolhe glyphs diferentes por ordem de módulo', () => {
    const a = render(<CourseGlyph order={1} />).container.querySelector('svg')
      ?.innerHTML
    const b = render(<CourseGlyph order={5} />).container.querySelector('svg')
      ?.innerHTML
    expect(a).toBeTruthy()
    expect(b).toBeTruthy()
    expect(a).not.toBe(b)
  })

  it('usa o glyph genérico (fallback) para ordem fora de 1–12', () => {
    const { container } = render(<CourseGlyph order={99} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
