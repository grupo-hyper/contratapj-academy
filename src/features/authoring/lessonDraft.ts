/**
 * lessonDraft — estado editável de UMA aula no editor do autor, desacoplado da
 * forma persistida (`Lesson`). Puro: sem React, sem Supabase — testável isolado.
 *
 * Regras:
 *  - `null` (banco) <-> `''` (form): campos opcionais (`youtube_id`, `texto_md`)
 *    aparecem como string vazia no textarea/input e voltam a `null` ao salvar.
 *  - `draftToUpdate` trima `titulo`/`youtube_id`; NÃO trima o miolo de `texto_md`
 *    (indentação de listas/código importa), só decide vazio-vira-null pelo trim.
 */
import type { Lesson } from '../../types/content'

/** Campos que a F1 deixa o autor editar. */
export interface LessonDraft {
  titulo: string
  youtube_id: string
  texto_md: string
  publicado: boolean
}

/** Colunas de `lessons` que o UPDATE da F1 grava. */
export interface LessonUpdate {
  titulo: string
  youtube_id: string | null
  texto_md: string | null
  publicado: boolean
}

/** Converte a aula persistida no draft do form (null -> ''). */
export function toDraft(lesson: Lesson): LessonDraft {
  return {
    titulo: lesson.titulo,
    youtube_id: lesson.youtube_id ?? '',
    texto_md: lesson.texto_md ?? '',
    publicado: lesson.publicado,
  }
}

/** true se algum campo do draft difere do original. */
export function isDirty(a: LessonDraft, b: LessonDraft): boolean {
  return (
    a.titulo !== b.titulo ||
    a.youtube_id !== b.youtube_id ||
    a.texto_md !== b.texto_md ||
    a.publicado !== b.publicado
  )
}

/** Normaliza o draft para o patch do UPDATE ('' trimado -> null). */
export function draftToUpdate(draft: LessonDraft): LessonUpdate {
  const youtube = draft.youtube_id.trim()
  const texto = draft.texto_md.trim()
  return {
    titulo: draft.titulo.trim(),
    youtube_id: youtube === '' ? null : youtube,
    texto_md: texto === '' ? null : draft.texto_md,
    publicado: draft.publicado,
  }
}
