import { existsSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import {
  collectSeed,
  parseLessonFile,
  parseModuleOrdem,
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
  it('extrai ordem e título de "PB-MM.NN — Titulo.md"', () => {
    expect(parseLessonFile('PB-01.05 — WhatsApp- Papel e Limites.md')).toEqual({
      ordem: 5,
      titulo: 'WhatsApp- Papel e Limites',
    })
  })
  it('rejeita nomes fora do padrão', () => {
    expect(parseLessonFile('leia-me.md')).toBeNull()
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
