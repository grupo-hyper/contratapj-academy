/**
 * ModuleEditor — painel DIREITO do CMS quando um MÓDULO está selecionado (F2).
 *
 * Form: título, descrição, capa_url, toggle Publicado/Rascunho. Espelha o
 * LessonEditor: dirty-tracking por `baseline`/`draft`, reporta `onDirtyChange`
 * ao pai (guarda de troca de item), aviso de beforeunload, e Salvar habilita só
 * quando há alteração.
 *
 * A persistência é do `updateModule` do `useAuthorMutations` (UPDATE em
 * `modules`), passado por prop pelo pai (mesmo hook que serve a árvore) para
 * manter uma única fonte de mutation. Reset ao trocar de módulo é do pai via
 * `key={module.id}`.
 */
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Module } from '../../types/content'
import type { ModulePatch } from './useAuthorMutations'

/** Estado editável do módulo no form (null do banco <-> '' no input). */
interface ModuleDraft {
  titulo: string
  descricao: string
  capa_url: string
  publicado: boolean
}

function toDraft(module: Module): ModuleDraft {
  return {
    titulo: module.titulo,
    descricao: module.descricao ?? '',
    capa_url: module.capa_url ?? '',
    publicado: module.publicado,
  }
}

function isDirty(a: ModuleDraft, b: ModuleDraft): boolean {
  return (
    a.titulo !== b.titulo ||
    a.descricao !== b.descricao ||
    a.capa_url !== b.capa_url ||
    a.publicado !== b.publicado
  )
}

/** Normaliza o draft para o patch do UPDATE ('' trimado -> null). */
function draftToPatch(draft: ModuleDraft): ModulePatch {
  const descricao = draft.descricao.trim()
  const capa = draft.capa_url.trim()
  return {
    titulo: draft.titulo.trim(),
    descricao: descricao === '' ? null : descricao,
    capa_url: capa === '' ? null : capa,
    publicado: draft.publicado,
  }
}

interface ModuleEditorProps {
  module: Module
  /** Persiste o patch (updateModule do useAuthorMutations). */
  onSave: (id: string, patch: ModulePatch) => void
  /** true enquanto a mutation está em voo (desabilita Salvar). */
  isSaving: boolean
  /** true se a última mutation falhou (erro inline). */
  isError: boolean
  /** Informa ao pai se há alterações não salvas (guarda de troca de item). */
  onDirtyChange: (dirty: boolean) => void
}

export function ModuleEditor({
  module,
  onSave,
  isSaving,
  isError,
  onDirtyChange,
}: ModuleEditorProps) {
  const initial = useMemo(() => toDraft(module), [module])
  const [baseline, setBaseline] = useState<ModuleDraft>(initial)
  const [draft, setDraft] = useState<ModuleDraft>(initial)

  const dirty = isDirty(baseline, draft)

  // Avisa o pai sobre o estado sujo (guarda de "trocar de item com alterações").
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  // Ao concluir o save (mutation deixa de estar em voo sem erro), o draft atual
  // vira o novo "salvo" — assim o form deixa de estar sujo sem remonte.
  const [wasSaving, setWasSaving] = useState(false)
  useEffect(() => {
    if (isSaving) {
      setWasSaving(true)
    } else if (wasSaving) {
      setWasSaving(false)
      if (!isError) setBaseline(draft)
    }
    // Só reagimos à borda de fim-de-save; `draft` é o que acabou de ser enviado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaving])

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

  const set = <K extends keyof ModuleDraft>(key: K, value: ModuleDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!dirty || isSaving) return
    onSave(module.id, draftToPatch(draft))
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-cpj-white">Editar módulo</h2>
        {dirty && (
          <span className="text-xs font-semibold text-cpj-coral">
            • alterações não salvas
          </span>
        )}
      </div>

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
          <span className="font-semibold text-cpj-white/80">Descrição</span>
          <textarea
            value={draft.descricao}
            onChange={(e) => set('descricao', e.target.value)}
            rows={4}
            className="rounded-xl border border-cpj-white/15 bg-cpj-navy/20 px-3 py-2 text-cpj-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-cpj-white/80">Capa (URL)</span>
          <input
            type="text"
            value={draft.capa_url}
            onChange={(e) => set('capa_url', e.target.value)}
            placeholder="https://…"
            className="rounded-xl border border-cpj-white/15 bg-cpj-navy/20 px-3 py-2 text-cpj-white placeholder:text-cpj-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal"
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
