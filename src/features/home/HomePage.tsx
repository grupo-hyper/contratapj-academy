/**
 * HomePage — dashboard do aluno (Task 3.2), estilo streaming dark.
 *
 * Composição pura: toda a busca/derivação vive em `useHomeData`; aqui só
 * montamos os componentes presentational (TopNav, Hero, Row, Tile) a partir do
 * estado já pronto. Reflete o PROGRESSO REAL do usuário logado.
 *
 * Estrutura:
 *  - TopNav com nome/papel do perfil e ação de sair.
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
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { Hero } from '../../components/Hero'
import { Row } from '../../components/Row'
import { Tile, type TileState } from '../../components/Tile'
import { TopNav } from '../../components/TopNav'
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

/** Primeira aula publicada NÃO concluída do módulo (a "próxima a assistir"). */
function findCurrentLesson(module: Module, data: HomeData): Lesson | undefined {
  const published = (data.lessonsByModule[module.id] ?? []).filter((l) => l.publicado)
  return published.find((l) => !data.concludedLessonIds.has(l.id))
}

/** Estado visual de uma aula dentro de um módulo liberado. */
function lessonTileState(
  lesson: Lesson,
  currentLessonId: string | undefined,
  data: HomeData,
): TileState {
  if (data.concludedLessonIds.has(lesson.id)) return 'done'
  if (lesson.id === currentLessonId) return 'current'
  // Aulas de um módulo liberado são todas assistíveis; não travamos aula.
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
  const { profile, user, loading, signOut } = useAuth()
  const navigate = useNavigate()

  const profileId = profile?.id ?? user?.id
  const { data, isLoading, isError } = useHomeData(profileId)

  const userName = profile?.nome ?? user?.email ?? 'Aluno'
  const role = profile?.role

  // Deriva os alvos do Hero a partir do estado da trilha.
  const heroModel = useMemo(() => {
    if (!data) return undefined
    const currentModule = findCurrentModule(data)
    if (!currentModule) {
      // Nenhum módulo current => trilha inteira concluída (ou vazia).
      const complete = data.modules.length > 0
      return { complete } as const
    }
    const currentLesson = findCurrentLesson(currentModule, data)
    return {
      complete: false,
      currentModule,
      currentLesson,
      progressPct: moduleProgressPct(currentModule, data),
    } as const
  }, [data])

  const showLoading = loading || isLoading

  return (
    <main className="min-h-screen bg-cpj-bg text-cpj-white">
      <TopNav userName={userName} role={role} onSignOut={signOut}>
        <span className="font-medium text-cpj-white">Início</span>
      </TopNav>

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
                  progressPct={moduleProgressPct(m, data)}
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
                    state={lessonTileState(
                      lesson,
                      heroModel.currentLesson?.id,
                      data,
                    )}
                    onClick={() => navigate(`/aula/${lesson.id}`)}
                  />
                ))}
            </Row>
          )}
        </div>
      )}
    </main>
  )
}
