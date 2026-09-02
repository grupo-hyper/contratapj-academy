/**
 * GoalsPage — painel de RITMO do aluno (Task 5.2, Fase 5), estilo streaming dark.
 *
 * Composição pura: a busca/derivação vive em `useGoals`; aqui só montamos a tela
 * a partir do modelo já pronto. Mostra, para a turma do aluno:
 *   - o STATUS do ritmo (em dia / atrasado / adiantado), com destaque de cor;
 *   - o ritmo alvo (módulos por semana) e o marco zero (matrícula, em BRT);
 *   - concluídos vs. esperado até agora, e quantos módulos faltam para ficar em dia.
 *
 * Estados: carregando, erro, "sem meta" (matriculado numa turma sem ritmo
 * definido, ou sem turma) e o painel com o status.
 */
import { useAuth } from '../../auth/useAuth'
import type { GoalStatus } from './useGoals'
import { useGoals } from './useGoals'

/** Formata um instante UTC ISO como data curta em BRT (America/Sao_Paulo). */
function formatBRDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Rótulo + classes de cor por status (dark). */
const STATUS_UI: Record<
  GoalStatus,
  { label: string; badge: string; ring: string }
> = {
  em_dia: {
    label: 'Em dia',
    badge: 'bg-cpj-royal/25 text-cpj-white',
    ring: 'border-cpj-royal/40',
  },
  adiantado: {
    label: 'Adiantado',
    badge: 'bg-emerald-500/20 text-emerald-300',
    ring: 'border-emerald-500/40',
  },
  atrasado: {
    label: 'Atrasado',
    badge: 'bg-cpj-coral/20 text-cpj-coral',
    ring: 'border-cpj-coral/40',
  },
}

function GoalsSkeleton() {
  return (
    <div className="mx-auto flex max-w-3xl animate-pulse flex-col gap-4 px-4 py-6">
      <div className="h-8 w-1/2 rounded bg-cpj-navy/40" />
      <div className="h-40 w-full rounded-2xl bg-cpj-navy/40" />
      <div className="h-24 w-full rounded-2xl bg-cpj-navy/40" />
    </div>
  )
}

/** Um cartão de número (concluídos / esperado / ritmo). */
function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-cpj-white/10 bg-cpj-navy/20 p-4 text-center">
      <div className="text-3xl font-bold tabular-nums text-cpj-white">
        {value}
      </div>
      <div className="mt-1 text-xs text-cpj-white/60">{label}</div>
    </div>
  )
}

export function GoalsPage() {
  const { profile, user, loading } = useAuth()
  const profileId = profile?.id ?? user?.id
  const { model, isLoading, isError } = useGoals(profileId)

  const showLoading = loading || isLoading

  function renderBody() {
    if (isError) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-cpj-white/70">
          <p className="text-lg font-semibold text-cpj-white">
            Não foi possível carregar suas metas.
          </p>
          <p className="mt-2 text-sm">Tente recarregar a página em instantes.</p>
        </div>
      )
    }

    // Sem meta: sem turma OU turma sem ritmo definido pelo gestor.
    if (!model.hasGoal || !model.computation) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-cpj-white/70">
          <p className="text-lg font-semibold text-cpj-white">
            Nenhuma meta de ritmo definida ainda.
          </p>
          <p className="mt-2 text-sm">
            {model.className
              ? `A sua turma (${model.className}) ainda não tem um ritmo definido pelo gestor.`
              : 'Você ainda não está numa turma com meta. Fale com o seu gestor.'}
          </p>
          {model.totalModules > 0 && (
            <p className="mt-4 text-sm text-cpj-white/50">
              Você já concluiu{' '}
              <span className="font-semibold text-cpj-white">
                {model.completedModules}
              </span>{' '}
              de {model.totalModules} módulos.
            </p>
          )}
        </div>
      )
    }

    const { computation } = model
    const ui = STATUS_UI[computation.status]
    // Esperado exibido arredondado (o cálculo interno é float).
    const expectedDisplay = Math.round(computation.expectedModules)
    const ritmoLabel =
      model.modulesPerWeek === 1
        ? '1 módulo por semana'
        : `${model.modulesPerWeek} módulos por semana`

    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold text-cpj-white sm:text-3xl">
            Seu ritmo
          </h1>
          {model.className && (
            <p className="mt-1 text-sm text-cpj-white/60">
              Turma {model.className} · meta de {ritmoLabel}
            </p>
          )}
        </div>

        {/* Cartão de status */}
        <div className={`rounded-2xl border bg-cpj-navy/30 p-6 ${ui.ring}`}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-cpj-white/60">Situação</span>
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${ui.badge}`}
            >
              {ui.label}
            </span>
          </div>
          <p className="mt-4 text-cpj-white">
            {computation.status === 'atrasado' ? (
              <>
                Você está{' '}
                <span className="font-semibold text-cpj-coral">atrasado</span> no
                ritmo da turma. Faltam{' '}
                <span className="font-semibold tabular-nums">
                  {computation.modulesBehind}
                </span>{' '}
                {computation.modulesBehind === 1 ? 'módulo' : 'módulos'} para
                ficar em dia.
              </>
            ) : computation.status === 'adiantado' ? (
              <>
                Muito bem — você está{' '}
                <span className="font-semibold text-emerald-300">adiantado</span>{' '}
                em relação ao ritmo da turma. Continue assim!
              </>
            ) : (
              <>
                Você está{' '}
                <span className="font-semibold text-cpj-white">em dia</span> com o
                ritmo da turma. Continue assim!
              </>
            )}
          </p>
        </div>

        {/* Números */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            value={String(computation.completedModules)}
            label="Módulos concluídos"
          />
          <StatCard value={String(expectedDisplay)} label="Esperado até agora" />
          <StatCard value={String(model.totalModules)} label="Total de módulos" />
        </div>

        {model.enrolledAtISO && (
          <p className="text-center text-xs text-cpj-white/40">
            Ritmo medido desde a sua matrícula em{' '}
            {formatBRDate(model.enrolledAtISO)}.
          </p>
        )}
      </div>
    )
  }

  return (
    <main className="ocean-bg min-h-screen text-cpj-white">
      {showLoading ? <GoalsSkeleton /> : renderBody()}
    </main>
  )
}

export default GoalsPage
