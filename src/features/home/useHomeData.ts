/**
 * useHomeData — camada de dados da Home do aluno (Task 3.2).
 *
 * Responsabilidade ÚNICA: buscar (via react-query + Supabase) os três insumos
 * que a Home precisa — módulos publicados, aulas publicadas e o progresso do
 * usuário logado — e DERIVAR deles a estrutura pronta para a UI:
 *   - `modules`            → módulos publicados ordenados por `ordem`
 *   - `lessonsByModule`    → aulas agrupadas por `module_id` (chave = id do módulo)
 *   - `concludedLessonIds` → Set dos ids de aula com `concluida = true`
 *   - `unlockState`        → resultado de `computeUnlockState` (trilha travada)
 *
 * NÃO renderiza nada e NÃO conhece componentes — a Home consome este hook e
 * compõe a tela. O agrupamento por `module_id` é feito aqui de propósito:
 * `computeUnlockState` confia nesse agrupamento (ver doc em useUnlock.ts).
 *
 * RLS: `lessons` só devolve publicadas ao aluno e `lesson_progress` é owner-only;
 * ainda assim filtramos explicitamente por `profile_id` e por `publicado` para
 * não depender só da política e manter o comportamento previsível em testes.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Lesson, Module, LessonProgress } from '../../types/content'
import { computeUnlockState, type UnlockStateMap } from './useUnlock'

async function fetchModules(): Promise<Module[]> {
  const { data, error } = await supabase
    .from('modules')
    .select('*')
    .eq('publicado', true)
    .order('ordem', { ascending: true })
  if (error) throw error
  return (data ?? []) as Module[]
}

async function fetchLessons(): Promise<Lesson[]> {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('publicado', true)
    .order('module_id', { ascending: true })
    .order('ordem', { ascending: true })
  if (error) throw error
  return (data ?? []) as Lesson[]
}

async function fetchProgress(profileId: string): Promise<LessonProgress[]> {
  const { data, error } = await supabase
    .from('lesson_progress')
    .select('*')
    .eq('profile_id', profileId)
  if (error) throw error
  return (data ?? []) as LessonProgress[]
}

/** Agrupa aulas por `module_id`, preservando a ordem já vinda do banco. */
function groupByModule(lessons: Lesson[]): Record<string, Lesson[]> {
  const map: Record<string, Lesson[]> = {}
  for (const lesson of lessons) {
    ;(map[lesson.module_id] ??= []).push(lesson)
  }
  return map
}

export interface HomeData {
  modules: Module[]
  lessonsByModule: Record<string, Lesson[]>
  concludedLessonIds: ReadonlySet<string>
  unlockState: UnlockStateMap
}

export interface UseHomeDataResult {
  data: HomeData | undefined
  isLoading: boolean
  isError: boolean
  error: unknown
}

/**
 * Hook público consumido pela HomePage. Recebe o `profileId` (== user.id) para
 * escopar o progresso; quando ausente (sessão ainda carregando) as queries
 * ficam desabilitadas e o hook reporta `isLoading`.
 */
export function useHomeData(profileId: string | undefined): UseHomeDataResult {
  // `modules`/`lessons` não dependem do usuário, mas são gated no mesmo `enabled`
  // que `progress` de propósito: espera a auth resolver antes de buscar, evitando
  // um flash de conteúdo sem o progresso do aluno já disponível.
  const enabled = Boolean(profileId)

  const modulesQuery = useQuery({
    queryKey: ['modules'],
    queryFn: fetchModules,
    enabled,
  })
  const lessonsQuery = useQuery({
    queryKey: ['lessons'],
    queryFn: fetchLessons,
    enabled,
  })
  const progressQuery = useQuery({
    queryKey: ['lesson_progress', profileId],
    queryFn: () => fetchProgress(profileId as string),
    enabled,
  })

  const isLoading =
    !enabled ||
    modulesQuery.isLoading ||
    lessonsQuery.isLoading ||
    progressQuery.isLoading
  const isError =
    modulesQuery.isError || lessonsQuery.isError || progressQuery.isError
  const error = modulesQuery.error ?? lessonsQuery.error ?? progressQuery.error

  const modules = modulesQuery.data
  const lessons = lessonsQuery.data
  const progress = progressQuery.data

  let data: HomeData | undefined
  if (modules && lessons && progress) {
    const lessonsByModule = groupByModule(lessons)
    const concludedLessonIds = new Set(
      progress.filter((p) => p.concluida).map((p) => p.lesson_id),
    )
    const unlockState = computeUnlockState({
      modules,
      lessonsByModule,
      concludedLessonIds,
    })
    data = { modules, lessonsByModule, concludedLessonIds, unlockState }
  }

  return { data, isLoading, isError, error }
}
