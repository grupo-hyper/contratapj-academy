/**
 * ClassDashboard — Painel do Gestor, bloco G3 (ritmo da turma).
 *
 * Tabela com uma linha por aluno matriculado: módulos concluídos vs. esperado e o
 * selo de status (em dia / atrasado / adiantado). O status reusa exatamente o
 * cálculo do painel do ALUNO (`computeGoalStatus`), para gestor e aluno verem a
 * MESMA verdade. Sem meta de ritmo definida, não há o que comparar.
 *
 * `now` é injetável para teste; em produção usa o relógio real.
 */
import { computeGoalStatus, type GoalStatus } from '../goals/useGoals'
import { useClassDashboard } from './useClassDashboard'

const STATUS_LABEL: Record<GoalStatus, string> = {
  em_dia: 'Em dia',
  atrasado: 'Atrasado',
  adiantado: 'Adiantado',
}

const STATUS_CLASS: Record<GoalStatus, string> = {
  em_dia: 'bg-cpj-royal/20 text-cpj-white',
  atrasado: 'bg-cpj-coral/20 text-cpj-coral',
  adiantado: 'bg-emerald-500/20 text-emerald-300',
}

function nomeOuFallback(nome: string | null): string {
  return nome && nome.trim() ? nome : '(sem nome)'
}

export function ClassDashboard({
  classId,
  modulesPerWeek,
  now = new Date(),
}: {
  classId: string
  modulesPerWeek: number | null
  now?: Date
}) {
  const { rows, totalModules, isLoading, isError } = useClassDashboard(classId)

  return (
    <section className="flex flex-col gap-3 border-t border-cpj-white/10 pt-5">
      <h3 className="font-display text-sm font-bold uppercase tracking-wide text-cpj-white/50">
        Ritmo da turma
      </h3>

      {modulesPerWeek === null ? (
        <p className="text-sm text-cpj-white/50">
          Defina uma meta de ritmo para acompanhar o andamento da turma.
        </p>
      ) : isError ? (
        <p className="text-sm text-cpj-coral">
          Não foi possível carregar o ritmo (sem acesso ou falha de rede).
        </p>
      ) : isLoading ? (
        <p className="text-sm text-cpj-white/50">Carregando ritmo…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-cpj-white/50">
          Nenhum aluno matriculado para acompanhar.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-cpj-white/40">
                <th className="py-2 pr-3 font-semibold">Aluno</th>
                <th className="py-2 pr-3 font-semibold">Concluídos</th>
                <th className="py-2 pr-3 font-semibold">Esperado</th>
                <th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = computeGoalStatus({
                  modulesPerWeek,
                  enrolledAtISO: r.enrolledAtISO,
                  completedModules: r.completedModules,
                  totalModules,
                  now,
                })
                return (
                  <tr
                    key={r.profileId}
                    className="border-t border-cpj-white/5 text-cpj-white/90"
                  >
                    <td className="py-2 pr-3">{nomeOuFallback(r.nome)}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {r.completedModules}
                      {totalModules > 0 && (
                        <span className="text-cpj-white/40">/{totalModules}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-cpj-white/70">
                      {c.expectedModules.toFixed(1)}
                    </td>
                    <td className="py-2">
                      <span
                        className={[
                          'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          STATUS_CLASS[c.status],
                        ].join(' ')}
                      >
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
