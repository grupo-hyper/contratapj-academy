/**
 * ManagerPage — Painel do Gestor (rota /gestor).
 *
 * Master–detail: à esquerda a lista de TURMAS do gestor (+ criar nova); à direita
 * o detalhe da turma selecionada. Bloco G1 (esta entrega): renomear/excluir a
 * turma e definir a META de ritmo (módulos por semana). Os blocos G2 (matrículas)
 * e G3 (dashboard de ritmo) entram no mesmo painel direito, em seguida.
 *
 * Escrita restrita ao gestor DONO (RLS 0006); a UI degrada com erro inline se a
 * mutation falhar (ex.: admin sem role gestor no banco).
 */
import { useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { ClassRoster } from './ClassRoster'
import { useManagerClasses, type ManagerClass } from './useManagerClasses'

function ManagerSkeleton() {
  return (
    <div className="flex animate-pulse gap-6 p-6">
      <div className="h-96 w-72 rounded-2xl bg-cpj-navy/40" />
      <div className="h-96 flex-1 rounded-2xl bg-cpj-navy/40" />
    </div>
  )
}

/** Formulário de criar turma (input + botão), no rodapé da lista. */
function NewClassForm({
  onCreate,
  disabled,
}: {
  onCreate: (nome: string) => void
  disabled: boolean
}) {
  const [nome, setNome] = useState('')
  const trimmed = nome.trim()
  return (
    <form
      className="mt-3 flex gap-2 border-t border-cpj-white/10 pt-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!trimmed) return
        onCreate(trimmed)
        setNome('')
      }}
    >
      <input
        type="text"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nova turma"
        aria-label="Nome da nova turma"
        className="min-w-0 flex-1 rounded-lg border border-cpj-white/15 bg-cpj-navy/30 px-3 py-2 text-sm text-cpj-white placeholder:text-cpj-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal"
      />
      <button
        type="submit"
        disabled={disabled || !trimmed}
        className="rounded-lg bg-cpj-royal px-3 py-2 text-sm font-semibold text-cpj-white transition hover:bg-cpj-royal/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal disabled:cursor-not-allowed disabled:opacity-50"
      >
        Criar
      </button>
    </form>
  )
}

/** Editor da meta de ritmo (modules_per_week) da turma. */
function GoalEditor({
  turma,
  onSave,
  disabled,
}: {
  turma: ManagerClass
  onSave: (modulesPerWeek: number) => void
  disabled: boolean
}) {
  const [valor, setValor] = useState(
    turma.modulesPerWeek !== null ? String(turma.modulesPerWeek) : '',
  )
  const parsed = Number(valor.replace(',', '.'))
  const valido = Number.isFinite(parsed) && parsed > 0

  return (
    <section className="flex flex-col gap-3 border-t border-cpj-white/10 pt-5">
      <h3 className="font-display text-sm font-bold uppercase tracking-wide text-cpj-white/50">
        Meta de ritmo
      </h3>
      <p className="text-sm text-cpj-white/70">
        {turma.modulesPerWeek !== null ? (
          <>
            Ritmo-alvo atual:{' '}
            <strong className="text-cpj-white">
              {turma.modulesPerWeek} módulo(s)/semana
            </strong>
          </>
        ) : (
          'Esta turma ainda não tem meta de ritmo.'
        )}
      </p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valido) return
          onSave(parsed)
        }}
      >
        <label className="flex flex-col gap-1 text-sm text-cpj-white/70">
          Módulos por semana
          <input
            type="number"
            min="0"
            step="0.5"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            aria-label="Módulos por semana"
            className="w-40 rounded-lg border border-cpj-white/15 bg-cpj-navy/30 px-3 py-2 text-sm text-cpj-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal"
          />
        </label>
        <button
          type="submit"
          disabled={disabled || !valido}
          className="rounded-lg bg-cpj-royal px-4 py-2 text-sm font-semibold text-cpj-white transition hover:bg-cpj-royal/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal disabled:cursor-not-allowed disabled:opacity-50"
        >
          Salvar meta
        </button>
      </form>
    </section>
  )
}

/** Painel direito: detalhe da turma selecionada (renomear, excluir, meta). */
function ClassDetail({
  turma,
  onRename,
  onDelete,
  onSetGoal,
  disabled,
}: {
  turma: ManagerClass
  onRename: (nome: string) => void
  onDelete: () => void
  onSetGoal: (modulesPerWeek: number) => void
  disabled: boolean
}) {
  const [nome, setNome] = useState(turma.nome)
  const trimmed = nome.trim()
  const renamed = trimmed && trimmed !== turma.nome

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho: nome editável + excluir. */}
      <header className="flex flex-col gap-3">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!renamed) return
            onRename(trimmed)
          }}
        >
          <label className="flex flex-1 flex-col gap-1 text-sm text-cpj-white/70">
            Nome da turma
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              aria-label="Nome da turma"
              className="w-full rounded-lg border border-cpj-white/15 bg-cpj-navy/30 px-3 py-2 text-base font-semibold text-cpj-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal"
            />
          </label>
          <button
            type="submit"
            disabled={disabled || !renamed}
            className="rounded-lg border border-cpj-white/15 px-4 py-2 text-sm font-semibold text-cpj-white/90 transition hover:bg-cpj-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal disabled:cursor-not-allowed disabled:opacity-50"
          >
            Renomear
          </button>
        </form>
        <div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              const ok = window.confirm(
                `Excluir a turma "${turma.nome}"? Isso remove as matrículas e a meta dela. Esta ação não pode ser desfeita.`,
              )
              if (ok) onDelete()
            }}
            className="rounded-lg border border-cpj-coral/40 px-3 py-2 text-sm font-semibold text-cpj-coral transition hover:bg-cpj-coral/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-coral disabled:cursor-not-allowed disabled:opacity-50"
          >
            Excluir turma
          </button>
        </div>
      </header>

      <GoalEditor turma={turma} onSave={onSetGoal} disabled={disabled} />

      {/* G2: matrículas da turma (lista + busca/adiciona alunos). */}
      <ClassRoster classId={turma.id} />
    </div>
  )
}

export function ManagerPage() {
  const { profile, user } = useAuth()
  const gestorId = profile?.id ?? user?.id

  const {
    classes,
    isLoading,
    isError,
    createClass,
    renameClass,
    deleteClass,
    setGoal,
    isMutating,
    isMutationError,
  } = useManagerClasses(gestorId)

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const selected = classes.find((c) => c.id === selectedClassId) ?? null

  if (isLoading) {
    return (
      <main className="ocean-bg min-h-screen text-cpj-white">
        <ManagerSkeleton />
      </main>
    )
  }

  return (
    <main className="ocean-bg min-h-screen text-cpj-white">
      <div className="grid gap-6 p-4 md:p-6 lg:grid-cols-[18rem_1fr]">
        {/* Painel esquerdo: turmas + criar. */}
        <aside className="rounded-2xl border border-cpj-white/10 bg-cpj-navy/10 p-3">
          <h1 className="mb-3 px-2 text-sm font-bold uppercase tracking-wide text-cpj-white/50">
            Turmas
          </h1>
          {isError ? (
            <p className="px-2 text-sm text-cpj-coral">
              Não foi possível carregar as turmas (sem acesso ou falha de rede).
            </p>
          ) : classes.length === 0 ? (
            <p className="px-2 text-sm text-cpj-white/50">
              Nenhuma turma ainda. Crie a primeira abaixo.
            </p>
          ) : (
            <nav aria-label="Turmas" className="flex flex-col gap-1">
              {classes.map((c) => {
                const active = c.id === selectedClassId
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedClassId(c.id)}
                    aria-current={active ? 'true' : undefined}
                    className={[
                      'flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition',
                      active
                        ? 'bg-cpj-royal/25 text-cpj-white'
                        : 'text-cpj-white/70 hover:bg-cpj-white/10 hover:text-cpj-white',
                    ].join(' ')}
                  >
                    <span className="truncate font-medium">{c.nome}</span>
                    <span className="shrink-0 text-xs text-cpj-white/40">
                      {c.modulesPerWeek !== null
                        ? `${c.modulesPerWeek}/sem`
                        : 'sem meta'}
                    </span>
                  </button>
                )
              })}
            </nav>
          )}
          <NewClassForm onCreate={createClass} disabled={isMutating} />
        </aside>

        {/* Painel direito: detalhe da turma ou placeholder. */}
        <section className="rounded-2xl border border-cpj-white/10 bg-cpj-navy/10 p-4 md:p-6">
          {isMutationError && (
            <p role="alert" className="mb-4 text-sm text-cpj-coral">
              Não foi possível salvar. Verifique seu acesso e tente novamente.
            </p>
          )}
          {selected ? (
            <ClassDetail
              key={selected.id}
              turma={selected}
              onRename={(nome) => renameClass(selected.id, nome)}
              onDelete={() => {
                deleteClass(selected.id)
                setSelectedClassId(null)
              }}
              onSetGoal={(mpw) => setGoal(selected.id, mpw)}
              disabled={isMutating}
            />
          ) : (
            <div className="flex h-full min-h-[16rem] items-center justify-center text-center text-cpj-white/50">
              Selecione uma turma para gerenciar.
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default ManagerPage
