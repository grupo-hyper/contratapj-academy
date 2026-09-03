/**
 * useLesson — camada de dados do player de aula (Task 3.3).
 *
 * Responsabilidade ÚNICA: buscar (via react-query + Supabase) a aula publicada
 * pelo id e o progresso do usuário logado NAQUELA aula, além de expor a mutation
 * `markConcluded` que grava a conclusão manual.
 *
 * NÃO renderiza nada — a `LessonPage` consome este hook e compõe a tela.
 *
 * RLS: `lessons` só devolve publicadas ao aluno e `lesson_progress` é owner-only;
 * ainda assim filtramos por `publicado` e por `profile_id` explicitamente para
 * manter o comportamento previsível (e testável) sem depender só da política.
 *
 * Invalidação: ao marcar concluída, invalidamos a query de progresso da HOME
 * (`['lesson_progress', profileId]`, mesma chave usada em `useHomeData.ts`) para
 * que a trilha do dashboard reflita a conclusão assim que o aluno voltar.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Lesson, LessonProgress } from '../../types/content'

async function fetchLesson(lessonId: string): Promise<Lesson | null> {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .eq('publicado', true)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as Lesson | null
}

async function fetchProgress(
  profileId: string,
  lessonId: string,
): Promise<LessonProgress | null> {
  const { data, error } = await supabase
    .from('lesson_progress')
    .select('*')
    .eq('profile_id', profileId)
    .eq('lesson_id', lessonId)
    .maybeSingle()
  if (error) {
    // PGRST205 = tabela ausente no schema cache (migration 0003 ainda não
    // aplicada no remoto). Degrada para "sem progresso" em vez de quebrar o player.
    if (error.code === 'PGRST205') {
      console.error(
        '[lesson] tabela lesson_progress ausente (aplicar supabase/migrations/0003_progress.sql):',
        error.message,
      )
      return null
    }
    throw error
  }
  return (data ?? null) as LessonProgress | null
}

async function upsertProgress(
  profileId: string,
  lessonId: string,
  concluida: boolean,
): Promise<void> {
  // O upsert é na chave única (profile_id, lesson_id). Não enviamos `updated_at`
  // (trigger BEFORE UPDATE mantém). `pct` acompanha o estado: 100 quando concluída,
  // 0 ao desmarcar (aluno clicou por engano e quer reverter).
  const { error } = await supabase.from('lesson_progress').upsert(
    { profile_id: profileId, lesson_id: lessonId, pct: concluida ? 100 : 0, concluida },
    { onConflict: 'profile_id,lesson_id' },
  )
  if (error) throw error
}

export interface UseLessonResult {
  lesson: Lesson | null | undefined
  progress: LessonProgress | null | undefined
  concluida: boolean
  isLoading: boolean
  isError: boolean
  error: unknown
  /** Marca a aula como concluída (upsert 100% + invalida a Home). */
  markConcluded: () => void
  /** Desmarca a conclusão (upsert 0% + invalida a Home) — reverte clique por engano. */
  unmarkConcluded: () => void
  isMarking: boolean
  /** true se o upsert de conclusão falhou (RLS/rede) — para feedback na UI. */
  isMarkError: boolean
  /** Erro da última tentativa de conclusão (se houver). */
  markError: unknown
}

/**
 * Hook público consumido pela LessonPage. Recebe o `lessonId` (da rota) e o
 * `userId` (== profile.id == lesson_progress.profile_id). Enquanto qualquer um
 * dos dois estiver ausente as queries ficam desabilitadas e o hook reporta
 * `isLoading`.
 */
export function useLesson(
  lessonId: string | undefined,
  userId: string | undefined,
): UseLessonResult {
  const queryClient = useQueryClient()
  const enabled = Boolean(lessonId && userId)

  const lessonQuery = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: () => fetchLesson(lessonId as string),
    enabled,
  })

  const progressQuery = useQuery({
    queryKey: ['lesson_progress_one', userId, lessonId],
    queryFn: () => fetchProgress(userId as string, lessonId as string),
    enabled,
  })

  const mutation = useMutation({
    mutationFn: (concluida: boolean) =>
      upsertProgress(userId as string, lessonId as string, concluida),
    onSuccess: () => {
      // Reflete a conclusão no player (a query desta aula) E na Home (a query de
      // progresso do dashboard, mesma chave de `useHomeData.ts`).
      void queryClient.invalidateQueries({
        queryKey: ['lesson_progress_one', userId, lessonId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['lesson_progress', userId],
      })
    },
  })

  const concluida = progressQuery.data?.concluida ?? false

  return {
    lesson: lessonQuery.data,
    progress: progressQuery.data,
    concluida,
    isLoading: !enabled || lessonQuery.isLoading || progressQuery.isLoading,
    isError: lessonQuery.isError || progressQuery.isError,
    error: lessonQuery.error ?? progressQuery.error,
    markConcluded: () => mutation.mutate(true),
    unmarkConcluded: () => mutation.mutate(false),
    isMarking: mutation.isPending,
    isMarkError: mutation.isError,
    markError: mutation.error,
  }
}
