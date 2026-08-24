import { describe, expect, it } from 'vitest'
import {
  buildSeedQuestions,
  OPTIONS_PER_QUESTION,
  QUESTIONS_PER_MODULE,
} from './seed-questions'

describe('buildSeedQuestions', () => {
  it('gera a quantidade padrão de questões, cada uma com as alternativas esperadas', () => {
    const qs = buildSeedQuestions('Prospecção')
    expect(qs).toHaveLength(QUESTIONS_PER_MODULE)
    for (const q of qs) {
      expect(q.options).toHaveLength(OPTIONS_PER_QUESTION)
    }
  })

  it('marca EXATAMENTE uma alternativa correta por questão', () => {
    const qs = buildSeedQuestions('Objeções', 3)
    expect(qs).toHaveLength(3)
    for (const q of qs) {
      expect(q.options.filter((o) => o.correta)).toHaveLength(1)
    }
  })

  it('é pura/determinística e referencia o módulo no texto', () => {
    const a = buildSeedQuestions('Fechamento')
    const b = buildSeedQuestions('Fechamento')
    expect(a).toEqual(b)
    expect(a[0].enunciado).toContain('Fechamento')
  })
})
