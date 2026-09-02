/**
 * Testes de splitIntoSlides: divisão por seção `## N.`, slide de abertura,
 * fallback sem seção e conteúdo vazio.
 */
import { describe, expect, it } from 'vitest'
import { splitIntoSlides } from './lessonSlides'

describe('splitIntoSlides', () => {
  it('divide por seção ## e mantém o heading junto do conteúdo', () => {
    const md = [
      '> **Regra de ouro:** faça isso.',
      '',
      '## 1. Objetivo',
      'Texto do objetivo.',
      '',
      '## 2. Passos',
      '- a',
      '- b',
    ].join('\n')

    const slides = splitIntoSlides(md)
    expect(slides).toHaveLength(3)
    expect(slides[0]).toContain('Regra de ouro')
    expect(slides[1]).toContain('## 1. Objetivo')
    expect(slides[1]).toContain('Texto do objetivo.')
    expect(slides[2]).toContain('## 2. Passos')
  })

  it('sem abertura: começa direto na primeira seção', () => {
    const md = '## 1. A\ntexto\n\n## 2. B\ntexto'
    const slides = splitIntoSlides(md)
    expect(slides).toHaveLength(2)
    expect(slides[0].startsWith('## 1. A')).toBe(true)
  })

  it('não quebra em ### (nível 3), só em ##', () => {
    const md = '## 1. Seção\ntexto\n### Subseção\nmais texto'
    const slides = splitIntoSlides(md)
    expect(slides).toHaveLength(1)
    expect(slides[0]).toContain('### Subseção')
  })

  it('sem nenhuma seção → um único slide', () => {
    const md = 'Só um parágrafo corrido, sem headings de seção.'
    expect(splitIntoSlides(md)).toEqual([md])
  })

  it('markdown vazio/nulo → nenhum slide', () => {
    expect(splitIntoSlides('')).toEqual([])
    expect(splitIntoSlides('   \n  ')).toEqual([])
    expect(splitIntoSlides(null)).toEqual([])
    expect(splitIntoSlides(undefined)).toEqual([])
  })
})
