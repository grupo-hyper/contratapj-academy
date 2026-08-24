/**
 * LessonPage — player da aula (Task 3.3), estilo streaming dark.
 *
 * Composição pura: a busca/derivação vive em `useLesson`; aqui montamos a tela
 * (TopNav + voltar, título, vídeo, texto) e o botão "Marcar como concluída".
 *
 * Conclusão: mecanismo confiável = botão MANUAL. Ao clicar, `markConcluded`
 * grava o progresso (upsert 100%) e invalida a query de progresso da Home, então
 * a trilha do dashboard reflete a conclusão quando o aluno voltar.
 */
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { ProgressBar } from '../../components/ProgressBar'
import { TopNav } from '../../components/TopNav'
import { LessonText } from './LessonText'
import { LessonVideo } from './LessonVideo'
import { useLesson } from './useLesson'

/** Esqueleto dark simples enquanto carrega. */
function LessonSkeleton() {
  return (
    <div className="mx-auto flex max-w-4xl animate-pulse flex-col gap-6 px-4 py-6">
      <div className="h-8 w-2/3 rounded bg-cpj-navy/40" />
      <div className="aspect-video w-full rounded-2xl bg-cpj-navy/40" />
      <div className="h-4 w-full rounded bg-cpj-navy/40" />
      <div className="h-4 w-5/6 rounded bg-cpj-navy/40" />
      <div className="h-4 w-4/6 rounded bg-cpj-navy/40" />
    </div>
  )
}

export function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const { profile, user, loading, signOut } = useAuth()

  // Mesma resolução de id usada na Home, para a invalidação da query de
  // progresso casar EXATAMENTE com a chave `['lesson_progress', profileId]`.
  const profileId = profile?.id ?? user?.id
  const userName = profile?.nome ?? user?.email ?? 'Aluno'
  const role = profile?.role

  const { lesson, concluida, isLoading, isError, markConcluded, isMarking } =
    useLesson(lessonId, profileId)

  const showLoading = loading || isLoading

  return (
    <main className="min-h-screen bg-cpj-bg text-cpj-white">
      <TopNav userName={userName} role={role} onSignOut={signOut}>
        <Link
          to="/"
          className="text-cpj-white/70 transition hover:text-cpj-white"
        >
          ← Voltar
        </Link>
      </TopNav>

      {showLoading ? (
        <LessonSkeleton />
      ) : isError || !lesson ? (
        <div className="mx-auto max-w-4xl px-4 py-16 text-center text-cpj-white/70">
          <p className="text-lg font-semibold text-cpj-white">
            Aula não encontrada.
          </p>
          <p className="mt-2 text-sm">
            Ela pode não existir ou ainda não estar publicada.
          </p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-lg bg-cpj-royal px-4 py-2 text-sm font-medium text-cpj-white transition hover:bg-cpj-royal/90"
          >
            Voltar para a Home
          </Link>
        </div>
      ) : (
        <article className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
          <h1 className="text-2xl font-bold text-cpj-white sm:text-3xl">
            {lesson.titulo}
          </h1>

          <LessonVideo youtubeId={lesson.youtube_id} title={lesson.titulo} />

          <LessonText markdown={lesson.texto_md} />

          {/* Bloco de conclusão manual (mecanismo confiável de progresso). */}
          <div className="mt-2 flex flex-col gap-3 border-t border-cpj-white/10 pt-6">
            {concluida ? (
              <>
                <ProgressBar value={100} label="Progresso da aula" />
                <button
                  type="button"
                  disabled
                  className="w-full rounded-xl bg-cpj-navy/60 px-4 py-3 text-sm font-semibold text-cpj-white/70 sm:w-auto"
                >
                  Concluída ✓
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={markConcluded}
                disabled={isMarking}
                className="w-full rounded-xl bg-cpj-coral px-4 py-3 text-sm font-semibold text-cpj-white transition hover:bg-cpj-coral/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-coral disabled:opacity-60 sm:w-auto"
              >
                {isMarking ? 'Salvando…' : 'Marcar como concluída'}
              </button>
            )}
          </div>
        </article>
      )}
    </main>
  )
}
