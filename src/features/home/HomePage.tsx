/**
 * HomePage — dashboard do aluno (Task 3.2), estilo streaming dark.
 *
 * Composição pura: toda a busca/derivação vive em `useHomeData`; aqui só
 * montamos os componentes presentational (Hero, Row, Tile) a partir do estado
 * já pronto. Reflete o PROGRESSO REAL do usuário logado. A navegação global
 * (sidebar) vem do <AppLayout>, não desta página.
 *
 * Estrutura:
 *  - Hero "Continue de onde parou": aula corrente = primeira aula publicada
 *    não-concluída do módulo `current` (da trilha travada). Se tudo estiver
 *    concluído, mostra variante de conclusão da trilha.
 *  - Row "Sua trilha": os módulos como Tiles no estado done/current/locked
 *    (a "cadeia" da trilha — metas reais são Fase 5, não existem aqui).
 *  - Row "Aulas do módulo atual": aulas do módulo current; concluídas = done,
 *    a próxima = current, as demais também acionáveis (nunca locked dentro de
 *    um módulo liberado).
 */
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { Hero } from '../../components/Hero'
import { Row } from '../../components/Row'
import { Tile, type TileState } from '../../components/Tile'
import type { Lesson, Module } from '../../types/content'
import { useHomeData, type HomeData } from './useHomeData'

/** Progresso (%) de um módulo = aulas publicadas concluídas / total publicado. */
function moduleProgressPct(
  module: Module,
  data: HomeData,
): number {
  const published = (data.lessonsByModule[module.id] ?? []).filter((l) => l.publicado)
  if (published.length === 0) return 0
  const done = published.filter((l) => data.concludedLessonIds.has(l.id)).length
  return Math.round((done / published.length) * 100)
}

/** Módulo `current` da trilha (o único não-concluído mais baixo liberado). */
function findCurrentModule(data: HomeData): Module | undefined {
  return data.modules.find((m) => data.unlockState[m.id]?.state === 'current')
}

/**
 * true quando o módulo já teve TODAS as aulas publicadas concluídas mas o quiz
 * ainda não foi aprovado — ou seja, o único passo que falta é fazer o teste.
 * (Um módulo `current` nesse estado ficou travado pelo seam de quiz.)
 */
function needsQuiz(module: Module, data: HomeData): boolean {
  const published = (data.lessonsByModule[module.id] ?? []).filter(
    (l) => l.publicado,
  )
  const allDone =
    published.length > 0 &&
    published.every((l) => data.concludedLessonIds.has(l.id))
  const quiz = data.quizByModule[module.id]
  const passed = quiz?.passed ?? false
  return allDone && !passed
}

/** Primeira aula publicada NÃO concluída do módulo (a "próxima a assistir"). */
function findCurrentLesson(module: Module, data: HomeData): Lesson | undefined {
  const published = (data.lessonsByModule[module.id] ?? []).filter((l) => l.publicado)
  return published.find((l) => !data.concludedLessonIds.has(l.id))
}

/** Estado visual de uma aula dentro de um módulo liberado. */
function lessonTileState(lesson: Lesson, data: HomeData): TileState {
  if (data.concludedLessonIds.has(lesson.id)) return 'done'
  // Não existe estado "locked" para aula dentro de um módulo liberado: todas
  // são assistíveis (o travamento é por MÓDULO, não por aula). Logo, qualquer
  // aula não-concluída é 'current'.
  return 'current'
}

/** Esqueleto dark simples enquanto carrega. */
function HomeSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl animate-pulse flex-col gap-6 px-4 py-6">
      <div className="h-56 w-full rounded-2xl bg-cpj-navy/40" />
      <div className="h-6 w-40 rounded bg-cpj-navy/40" />
      <div className="flex gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-40 w-40 shrink-0 rounded-xl bg-cpj-navy/40 sm:w-48" />
        ))}
      </div>
    </div>
  )
}

export function HomePage() {
  const { profile, user, loading } = useAuth()
  const navigate = useNavigate()

  const profileId = profile?.id ?? user?.id
  const { data, isLoading, isError } = useHomeData(profileId)

  // Deriva os alvos do Hero a partir do estado da trilha.
  const heroModel = useMemo(() => {
    if (!data) return undefined
    const currentModule = findCurrentModule(data)
    if (!currentModule) {
      // Nenhum módulo current => trilha inteira concluída (ou vazia).
      const complete = data.modules.length > 0
      return { complete } as const
    }
    // Invariante (ver useUnlock.ts): um módulo `current` NUNCA está `done`, logo
    // sempre tem ao menos uma aula publicada não-concluída => `currentLesson`
    // não é undefined aqui. O `if (heroModel.currentLesson)` no onAction abaixo
    // é apenas defesa (narrowing de tipo), não um caso esperado.
    const currentLesson = findCurrentLesson(currentModule, data)
    return {
      complete: false,
      currentModule,
      currentLesson,
      progressPct: moduleProgressPct(currentModule, data),
    } as const
  }, [data])

  // Pré-computa o progresso (%) de cada módulo UMA vez por mudança de `data`,
  // em vez de recomputar O(aulas) por módulo a cada render dentro do .map.
  const progressByModule = useMemo(() => {
    const map: Record<string, number> = {}
    if (data) {
      for (const m of data.modules) map[m.id] = moduleProgressPct(m, data)
    }
    return map
  }, [data])

  const showLoading = loading || isLoading

  return (
    <main className="ocean-bg min-h-screen text-cpj-white">
      {showLoading ? (
        <HomeSkeleton />
      ) : isError || !data ? (
        <div className="mx-auto max-w-6xl px-4 py-16 text-center text-cpj-white/70">
          <p className="text-lg font-semibold text-cpj-white">
            Não foi possível carregar sua trilha.
          </p>
          <p className="mt-2 text-sm">Tente recarregar a página em instantes.</p>
        </div>
      ) : data.modules.length === 0 ? (
        <div className="mx-auto max-w-6xl px-4 py-16 text-center text-cpj-white/70">
          <p className="text-lg font-semibold text-cpj-white">
            Nenhum módulo publicado ainda.
          </p>
          <p className="mt-2 text-sm">Volte em breve — o conteúdo está a caminho.</p>
        </div>
      ) : (
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-6">
          {/* Hero "continue assistindo" */}
          {heroModel && heroModel.complete ? (
            <Hero
              title="Você concluiu a trilha! 🎉"
              subtitle="Parabéns — todos os módulos foram concluídos. Revise quando quiser."
              actionLabel="Revisar do início"
              onAction={() => {
                const first = data.modules[0]
                const lesson = first
                  ? (data.lessonsByModule[first.id] ?? []).find((l) => l.publicado)
                  : undefined
                if (lesson) navigate(`/aula/${lesson.id}`)
              }}
            />
          ) : heroModel && heroModel.currentModule ? (
            <Hero
              title={heroModel.currentLesson?.titulo ?? heroModel.currentModule.titulo}
              subtitle={
                heroModel.currentModule.descricao ?? heroModel.currentModule.titulo
              }
              backgroundUrl={heroModel.currentModule.capa_url ?? undefined}
              progressPct={heroModel.progressPct}
              actionLabel={heroModel.progressPct > 0 ? 'Continuar' : 'Começar'}
              onAction={() => {
                if (heroModel.currentLesson) {
                  navigate(`/aula/${heroModel.currentLesson.id}`)
                }
              }}
            />
          ) : null}

          {/* Row "Sua trilha" — os módulos como cadeia (done/current/locked) */}
          <Row title="Sua trilha">
            {data.modules.map((m) => {
              const unlock = data.unlockState[m.id]
              const state: TileState = unlock?.state ?? 'locked'
              return (
                <Tile
                  key={m.id}
                  title={m.titulo}
                  subtitle={`Módulo ${m.ordem}`}
                  state={state}
                  coverUrl={m.capa_url ?? undefined}
                  glyphOrder={m.ordem}
                  progressPct={progressByModule[m.id] ?? 0}
                  onClick={() => {
                    // Só módulos liberados navegam; o Tile locked já ignora onClick.
                    const first = (data.lessonsByModule[m.id] ?? []).find(
                      (l) => l.publicado,
                    )
                    if (first) navigate(`/aula/${first.id}`)
                  }}
                />
              )
            })}
          </Row>

          {/* Row "Aulas do módulo atual" */}
          {heroModel && !heroModel.complete && heroModel.currentModule && (
            <Row title="Aulas do módulo atual">
              {(data.lessonsByModule[heroModel.currentModule.id] ?? [])
                .filter((l) => l.publicado)
                .map((lesson) => (
                  <Tile
                    key={lesson.id}
                    title={lesson.titulo}
                    subtitle={`Aula ${lesson.ordem}`}
                    state={lessonTileState(lesson, data)}
                    onClick={() => navigate(`/aula/${lesson.id}`)}
                  />
                ))}
            </Row>
          )}

          {/* Seam Fase 4: aulas do módulo atual concluídas, falta o teste. */}
          {heroModel &&
            !heroModel.complete &&
            heroModel.currentModule &&
            needsQuiz(heroModel.currentModule, data) && (
              <div className="rounded-2xl border border-cpj-coral/30 bg-cpj-navy/30 p-5 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-cpj-white">
                    Você concluiu as aulas deste módulo.
                  </p>
                  <p className="mt-1 text-sm text-cpj-white/60">
                    Faça o teste (nota mínima 80%) para liberar o próximo módulo.
                  </p>
                </div>
                <Link
                  to={`/quiz/${heroModel.currentModule.id}`}
                  className="mt-4 inline-block rounded-xl bg-cpj-coral px-4 py-2.5 text-sm font-semibold text-cpj-white transition hover:bg-cpj-coral/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-coral sm:mt-0"
                >
                  Fazer teste do módulo
                </Link>
              </div>
            )}
        </div>
      )}
    </main>
  )
}
