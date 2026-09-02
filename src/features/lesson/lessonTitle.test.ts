import { describe, expect, it } from 'vitest'
import {
  parseLessonTitle,
  firstMarkdownLine,
  stripLeadingH1,
  stripSourcesSection,
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

describe('stripSourcesSection', () => {
  it('remove a seção "## N. Fontes" (e o --- anterior) até o fim', () => {
    const md = [
      '## 1. Objetivo',
      'texto',
      '',
      '---',
      '',
      '## 11. Fontes',
      '**KB:** seção 4',
      '- vídeo https://youtu.be/x',
    ].join('\n')
    expect(stripSourcesSection(md)).toBe('## 1. Objetivo\ntexto')
  })

  it('não remove "## 3. Falas de referência" (conteúdo, não fonte)', () => {
    const md = '## 3. Falas de referência (do aprendizado)\n- fala'
    expect(stripSourcesSection(md)).toBe(md)
  })

  it('devolve intacto quando não há seção de fontes', () => {
    expect(stripSourcesSection('## 1. Objetivo\ntexto')).toBe(
      '## 1. Objetivo\ntexto',
    )
  })
})
