/**
 * ClassRoster — Painel do Gestor, bloco G2 (matrículas de UMA turma).
 *
 * Renderiza duas listas: os alunos MATRICULADOS (com botão remover) e um seletor
 * de ALUNOS DISPONÍVEIS com busca por nome (com botão matricular). A camada de
 * dados vive em `useClassRoster`; aqui é só composição + estado local da busca.
 */
import { useState } from 'react'
import { useClassRoster } from './useClassRoster'

/** Quantos candidatos mostrar por vez (a busca refina; evita lista gigante). */
const MAX_SUGGESTIONS = 8

function nomeOuFallback(nome: string | null): string {
  return nome && nome.trim() ? nome : '(sem nome)'
}

export function ClassRoster({ classId }: { classId: string }) {
  const {
    enrolled,
    available,
    isLoading,
    isError,
    enroll,
    unenroll,
    isMutating,
    isMutationError,
  } = useClassRoster(classId)

  const [busca, setBusca] = useState('')
  const termo = busca.trim().toLowerCase()
  const candidatos = available.filter((a) =>
    nomeOuFallback(a.nome).toLowerCase().includes(termo),
  )

  return (
    <section className="flex flex-col gap-5 border-t border-cpj-white/10 pt-5">
      <h3 className="font-display text-sm font-bold uppercase tracking-wide text-cpj-white/50">
        Alunos da turma
      </h3>

      {isMutationError && (
        <p role="alert" className="text-sm text-cpj-coral">
          Não foi possível atualizar a matrícula. Tente novamente.
        </p>
      )}

      {isError ? (
        <p className="text-sm text-cpj-coral">
          Não foi possível carregar os alunos (sem acesso ou falha de rede).
        </p>
      ) : isLoading ? (
        <p className="text-sm text-cpj-white/50">Carregando alunos…</p>
      ) : (
        <>
          {/* Matriculados. */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-cpj-white/40">
              Matriculados ({enrolled.length})
            </p>
            {enrolled.length === 0 ? (
              <p className="text-sm text-cpj-white/50">
                Nenhum aluno matriculado ainda.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {enrolled.map((s) => (
                  <li
                    key={s.enrollmentId}
                    className="flex items-center justify-between gap-2 rounded-lg bg-cpj-navy/20 px-3 py-2 text-sm"
                  >
                    <span className="truncate text-cpj-white">
                      {nomeOuFallback(s.nome)}
                    </span>
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => unenroll(s.enrollmentId)}
                      className="shrink-0 rounded-md border border-cpj-white/15 px-2.5 py-1 text-xs font-semibold text-cpj-white/80 transition hover:bg-cpj-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Adicionar aluno. */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-cpj-white/40">
              Adicionar aluno
            </p>
            {available.length === 0 ? (
              <p className="text-sm text-cpj-white/50">
                Todos os alunos já estão nesta turma.
              </p>
            ) : (
              <>
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar aluno pelo nome…"
                  aria-label="Buscar aluno"
                  className="rounded-lg border border-cpj-white/15 bg-cpj-navy/30 px-3 py-2 text-sm text-cpj-white placeholder:text-cpj-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal"
                />
                {candidatos.length === 0 ? (
                  <p className="text-sm text-cpj-white/50">
                    Nenhum aluno encontrado para “{busca}”.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {candidatos.slice(0, MAX_SUGGESTIONS).map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm hover:bg-cpj-white/5"
                      >
                        <span className="truncate text-cpj-white/90">
                          {nomeOuFallback(a.nome)}
                        </span>
                        <button
                          type="button"
                          disabled={isMutating}
                          onClick={() => enroll(a.id)}
                          className="shrink-0 rounded-md bg-cpj-royal px-2.5 py-1 text-xs font-semibold text-cpj-white transition hover:bg-cpj-royal/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Matricular
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {candidatos.length > MAX_SUGGESTIONS && (
                  <p className="text-xs text-cpj-white/40">
                    Mostrando {MAX_SUGGESTIONS} de {candidatos.length}. Refine a
                    busca para ver mais.
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}
