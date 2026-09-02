/**
 * LessonEditor — painel DIREITO do CMS: edição de UMA aula.
 *
 * Form: título, YouTube ID, textarea de `texto_md`, toggle Publicado/Rascunho.
 * Ao lado, PREVIEW em slides (LessonSlides com `gated={false}` = livre).
 * Botão Salvar (UPDATE via useSaveLesson) só habilita quando há alteração.
 *
 * Estado: o `draft` nasce de `toDraft(lesson)`. O RESET ao trocar de aula é do
 * pai (`key={lesson.id}` remonta este componente). Após salvar com sucesso,
 * rebaixamos o `baseline` para o draft salvo, então "sujo" volta a false sem
 * remonte. Reportamos `onDirtyChange(dirty)` para o pai guardar a troca de item.
 */
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Lesson } from '../../types/content'
import { LessonSlides } from '../lesson/LessonSlides'
import { draftToUpdate, isDirty, toDraft, type LessonDraft } from './lessonDraft'
import { useSaveLesson } from './useSaveLesson'

interface LessonEditorProps {
  lesson: Lesson
  /** Informa ao pai se há alterações não salvas (para guardar a troca de item). */
  onDirtyChange: (dirty: boolean) => void
}

export function LessonEditor({ lesson, onDirtyChange }: LessonEditorProps) {
  const initial = useMemo(() => toDraft(lesson), [lesson])
  // `baseline` = referência de "salvo". Começa igual ao initial; após salvar,
  // vira o draft salvo (para o form deixar de estar sujo sem remonte).
  const [baseline, setBaseline] = useState<LessonDraft>(initial)
  const [draft, setDraft] = useState<LessonDraft>(initial)
  const { save, isSaving, isError, isSuccess, reset } = useSaveLesson()

  const dirty = isDirty(baseline, draft)

  // Avisa o pai sobre o estado sujo (guarda de "trocar de aula com alterações").
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  // Ao concluir o save, o draft atual passa a ser o novo "salvo".
  useEffect(() => {
    if (isSuccess) {
      setBaseline(draft)
      reset()
    }
    // Só reagimos à borda de sucesso; `draft` aqui é o que acabou de ser enviado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess])

  // Aviso do navegador ao FECHAR/atualizar a aba com alterações não salvas.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const set = <K extends keyof LessonDraft>(key: K, value: LessonDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!dirty || isSaving) return
    save({ id: lesson.id, patch: draftToUpdate(draft) })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {/* Cabeçalho: título do editor + estado sujo/salvando. */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-cpj-white">Editar aula</h2>
        {dirty && (
          <span className="text-xs font-semibold text-cpj-coral">
            • alterações não salvas
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Coluna do formulário. */}
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-cpj-white/80">Título</span>
            <input
              type="text"
              value={draft.titulo}
              onChange={(e) => set('titulo', e.target.value)}
              className="rounded-xl border border-cpj-white/15 bg-cpj-navy/20 px-3 py-2 text-cpj-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-cpj-white/80">YouTube ID</span>
            <input
              type="text"
              value={draft.youtube_id}
              onChange={(e) => set('youtube_id', e.target.value)}
              placeholder="ex.: dQw4w9WgXcQ"
              className="rounded-xl border border-cpj-white/15 bg-cpj-navy/20 px-3 py-2 text-cpj-white placeholder:text-cpj-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-cpj-white/80">Conteúdo (Markdown)</span>
            <textarea
              value={draft.texto_md}
              onChange={(e) => set('texto_md', e.target.value)}
              rows={16}
              className="rounded-xl border border-cpj-white/15 bg-cpj-navy/20 px-3 py-2 font-mono text-sm text-cpj-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.publicado}
              onChange={(e) => set('publicado', e.target.checked)}
              className="h-4 w-4 accent-cpj-coral"
            />
            <span className="font-semibold text-cpj-white/80">
              Publicado {draft.publicado ? '' : '(rascunho)'}
            </span>
          </label>
        </div>

        {/* Coluna do preview em slides (navegação livre). */}
        <div className="rounded-2xl border border-cpj-white/10 bg-cpj-navy/10 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-cpj-white/40">
            Pré-visualização
          </div>
          <LessonSlides markdown={draft.texto_md || null} gated={false} />
        </div>
      </div>

      {/* Erro inline: mantém o form editável para retry. */}
      {isError && (
        <p className="text-sm text-cpj-coral">
          Não foi possível salvar. Verifique sua conexão/permissão e tente de novo.
        </p>
      )}

      <div className="flex items-center gap-3 border-t border-cpj-white/10 pt-4">
        <button
          type="submit"
          disabled={!dirty || isSaving}
          className="rounded-xl bg-cpj-coral px-5 py-2.5 text-sm font-semibold text-cpj-white transition hover:bg-cpj-coral/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-coral disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}
