import { describe, expect, it } from 'vitest'
import {
  parseLessonTitle,
  firstMarkdownLine,
  stripLeadingH1,
} from './lessonTitle'

describe('parseLessonTitle', () => {
  it('separa kicker + título de "# PB-02.01 — Título"', () => {
    expect(
      parseLessonTitle('# PB-02.01 — Os Primeiros Segundos: Abrir sem Vender'),
    ).toEqual({
      kicker: 'PB-02 · Abordagem',
      titulo: 'Os Primeiros Segundos: Abrir sem Vender',
    })
  })

  it('funciona sem o # e com hífen simples', () => {
    expect(parseLessonTitle('PB-11.03 - Algo')).toEqual({
      kicker: 'PB-11 · Antipadrões',
      titulo: 'Algo',
    })
  })

  it('usa só o código quando o módulo é desconhecido', () => {
    expect(parseLessonTitle('# PB-99.01 — X')?.kicker).toBe('PB-99')
  })

  it('retorna null quando não casa o padrão', () => {
    expect(parseLessonTitle('# Como prospectar clientes')).toBeNull()
    expect(parseLessonTitle(null)).toBeNull()
  })
})

describe('firstMarkdownLine', () => {
  it('pega a 1ª linha não-vazia', () => {
    expect(firstMarkdownLine('\n\n# Título\n\ncorpo')).toBe('# Título')
  })
  it('null quando vazio', () => {
    expect(firstMarkdownLine('')).toBeNull()
  })
})

describe('stripLeadingH1', () => {
  it('remove o h1 do topo e a linha em branco seguinte', () => {
    expect(stripLeadingH1('# Título\n\ncorpo aqui')).toBe('corpo aqui')
  })
  it('preserva o markdown quando não começa com h1', () => {
    expect(stripLeadingH1('> nota\n\n## Seção')).toBe('> nota\n\n## Seção')
  })
})
