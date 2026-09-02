import { describe, expect, it } from 'vitest'
import type { Lesson } from '../../types/content'
import { draftToUpdate, isDirty, toDraft } from './lessonDraft'

const lesson: Lesson = {
  id: 'l1',
  module_id: 'm1',
  ordem: 1,
  titulo: 'Abertura',
  texto_md: '## 1. Oi\ncorpo',
  youtube_id: 'abc123',
  duracao_seg: null,
  publicado: false,
  created_at: '2026-01-01T00:00:00Z',
}

describe('toDraft', () => {
  it('mapeia a Lesson para o draft, convertendo null em string vazia', () => {
    expect(toDraft({ ...lesson, texto_md: null, youtube_id: null })).toEqual({
      titulo: 'Abertura',
      youtube_id: '',
      texto_md: '',
      publicado: false,
    })
  })
})

describe('isDirty', () => {
  it('é false quando os drafts são iguais', () => {
    expect(isDirty(toDraft(lesson), toDraft(lesson))).toBe(false)
  })
  it('é true quando qualquer campo muda', () => {
    const base = toDraft(lesson)
    expect(isDirty(base, { ...base, titulo: 'Outro' })).toBe(true)
    expect(isDirty(base, { ...base, publicado: true })).toBe(true)
    expect(isDirty(base, { ...base, texto_md: 'x' })).toBe(true)
  })
})

describe('draftToUpdate', () => {
  it('trima e converte strings vazias em null (youtube_id/texto_md)', () => {
    const patch = draftToUpdate({
      titulo: '  Título  ',
      youtube_id: '   ',
      texto_md: '',
      publicado: true,
    })
    expect(patch).toEqual({
      titulo: 'Título',
      youtube_id: null,
      texto_md: null,
      publicado: true,
    })
  })
  it('preserva conteúdo não vazio de texto_md sem trimar o miolo', () => {
    const patch = draftToUpdate({
      titulo: 'T',
      youtube_id: 'vid',
      texto_md: '## 1. A\n\n  linha indentada',
      publicado: false,
    })
    expect(patch.texto_md).toBe('## 1. A\n\n  linha indentada')
    expect(patch.youtube_id).toBe('vid')
  })
})
