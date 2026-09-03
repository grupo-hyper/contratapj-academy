import { existsSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import {
  collectSeed,
  parseLessonFile,
  parseModuleOrdem,
  stripFrontmatter,
  extractTitleFromH1,
  DEFAULT_PLAYBOOKS_DIR,
  MODULE_TITLES,
} from './seed-lessons'

describe('parseModuleOrdem', () => {
  it('extrai a ordem do prefixo da pasta', () => {
    expect(parseModuleOrdem('01-Prospeccao')).toBe(1)
    expect(parseModuleOrdem('12-Numeros')).toBe(12)
  })
  it('rejeita fora do intervalo 1..12 ou sem número', () => {
    expect(parseModuleOrdem('13-Extra')).toBeNull()
    expect(parseModuleOrdem('Sem-Numero')).toBeNull()
  })
})

describe('parseLessonFile', () => {
  it('extrai a ordem de "NN.MM-slug-do-titulo.md"', () => {
    expect(parseLessonFile('05.03-tecnicas-de-reformulacao.md')).toEqual({ ordem: 3 })
    expect(parseLessonFile('10.28-ultimo-script.md')).toEqual({ ordem: 28 })
  })
  it('rejeita nomes fora do padrão', () => {
    expect(parseLessonFile('leia-me.md')).toBeNull()
  })
})

describe('stripFrontmatter', () => {
  it('remove o bloco --- ... --- do início e o espaço em branco seguinte', () => {
    const raw = '---\nplaybook: PB-05.03\nstatus: ativo\n---\n\n# PB-05.03 - Título\n\nCorpo.'
    expect(stripFrontmatter(raw)).toBe('# PB-05.03 - Título\n\nCorpo.')
  })
  it('devolve o conteúdo intacto quando não há frontmatter', () => {
    expect(stripFrontmatter('# PB-05.03 - Título\n\nCorpo.')).toBe('# PB-05.03 - Título\n\nCorpo.')
  })
})

describe('extractTitleFromH1', () => {
  it('extrai o título de "# PB-MM.NN - Título" (hífen, en dash ou travessão)', () => {
    expect(extractTitleFromH1('# PB-05.03 - Técnicas de Reformulação\n\nCorpo.')).toBe(
      'Técnicas de Reformulação',
    )
    expect(extractTitleFromH1('# PB-05.03 — Técnicas de Reformulação')).toBe(
      'Técnicas de Reformulação',
    )
  })
  it('retorna null quando a 1ª linha não é o h1 esperado', () => {
    expect(extractTitleFromH1('Corpo sem h1.')).toBeNull()
  })
})

describe('collectSeed (dry-run contra os MD reais)', () => {
  const dir = process.env.PLAYBOOKS_DIR ?? DEFAULT_PLAYBOOKS_DIR
  const disponivel = existsSync(dir)

  it.runIf(disponivel)('conta 12 módulos e 184 aulas', () => {
    const { modules, lessons } = collectSeed(dir)
    expect(modules).toHaveLength(12)
    expect(lessons).toHaveLength(184)
  })

  it.runIf(disponivel)('todos os módulos têm ordem 1..12 e título oficial', () => {
    const { modules } = collectSeed(dir)
    const ordens = modules.map((m) => m.ordem).sort((a, b) => a - b)
    expect(ordens).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    for (const m of modules) expect(m.titulo).toBe(MODULE_TITLES[m.ordem])
  })

  it.runIf(disponivel)('toda aula tem texto_md não vazio e pertence a um módulo válido', () => {
    const { lessons } = collectSeed(dir)
    for (const l of lessons) {
      expect(l.texto_md.length).toBeGreaterThan(0)
      expect(l.module_ordem).toBeGreaterThanOrEqual(1)
      expect(l.module_ordem).toBeLessThanOrEqual(12)
    }
  })
})
