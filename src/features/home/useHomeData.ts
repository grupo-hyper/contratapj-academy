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
import type {
  Lesson,
  Module,
  LessonProgress,
  QuizAttempt,
} from '../../types/content'
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
  if (error) {
    // PGRST205 = tabela ausente no schema cache (migration 0003 ainda não
    // aplicada no remoto). Degrada para "sem progresso" em vez de derrubar a
    // Home inteira — a trilha renderiza com tudo zerado.
    if (error.code === 'PGRST205') {
      console.error(
        '[home] tabela lesson_progress ausente (aplicar supabase/migrations/0003_progress.sql):',
        error.message,
      )
      return []
    }
    throw error
  }
  return (data ?? []) as LessonProgress[]
}

/**
 * Tentativas de quiz do usuário (todos os módulos). Alimentam o seam de quiz da
 * trilha (`quizPassedByModule`) e o resumo `quizByModule` da Home.
 * Degrada em PGRST205 exatamente como `fetchProgress` (0004 pode não estar
 * aplicada no remoto ainda) — nesse caso o seam fica permissivo (nenhum módulo
 * bloqueado por quiz), preservando o comportamento pré-Fase-4.
 */
async function fetchQuizAttempts(profileId: string): Promise<QuizAttempt[]> {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('profile_id', profileId)
  if (error) {
    if (error.code === 'PGRST205') {
      console.error(
        '[home] tabela quiz_attempts ausente (aplicar supabase/migrations/0004_quiz.sql):',
        error.message,
      )
      return []
    }
    throw error
  }
  return (data ?? []) as QuizAttempt[]
}

/**
 * Ids dos módulos que TÊM questões cadastradas (ou seja, têm teste). Usado para
 * decidir o seam de quiz: só um módulo COM teste pode ser bloqueado por quiz não
 * aprovado — módulo sem questões nunca trava (permissivo). Só selecionamos
 * `module_id` (barato); a RLS de `questions` já filtra por módulos publicados.
 */
async function fetchModulesWithQuiz(): Promise<Set<string>> {
  const { data, error } = await supabase.from('questions').select('module_id')
  if (error) {
    if (error.code === 'PGRST205') {
      console.error(
        '[home] tabela questions ausente (aplicar supabase/migrations/0002_content.sql):',
        error.message,
      )
      return new Set()
    }
    throw error
  }
  return new Set((data ?? []).map((r) => (r as { module_id: string }).module_id))
}

/** Agrupa aulas por `module_id`, preservando a ordem já vinda do banco. */
function groupByModule(lessons: Lesson[]): Record<string, Lesson[]> {
  const map: Record<string, Lesson[]> = {}
  for (const lesson of lessons) {
    ;(map[lesson.module_id] ??= []).push(lesson)
  }
  return map
}

/** Resumo por módulo das tentativas de quiz do usuário (para a UI da Home). */
export interface ModuleQuizSummary {
  attemptsUsed: number
  passed: boolean
  /** created_at (UTC ISO) da tentativa mais recente, ou null se nenhuma. */
  lastAttemptAt: string | null
}

export interface HomeData {
  modules: Module[]
  lessonsByModule: Record<string, Lesson[]>
  concludedLessonIds: ReadonlySet<string>
  unlockState: UnlockStateMap
  /** moduleId -> resumo de quiz (attemptsUsed/passed/lastAttemptAt). */
  quizByModule: Record<string, ModuleQuizSummary>
}

/** Deriva o resumo de quiz por módulo a partir das tentativas cruas. */
function summarizeQuiz(
  attempts: QuizAttempt[],
): Record<string, ModuleQuizSummary> {
  const map: Record<string, ModuleQuizSummary> = {}
  for (const a of attempts) {
    const s = (map[a.module_id] ??= {
      attemptsUsed: 0,
      passed: false,
      lastAttemptAt: null,
    })
    s.attemptsUsed += 1
    if (a.aprovado) s.passed = true
    if (!s.lastAttemptAt || a.created_at > s.lastAttemptAt) {
      s.lastAttemptAt = a.created_at
    }
  }
  return map
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
  // Seam da Fase 4: tentativas de quiz do usuário. Mesma chave usada para
  // invalidar em `useSubmitQuiz` (['quiz_attempts', profileId]) — passar o quiz
  // faz esta query refazer e a trilha reavaliar o gate.
  const quizQuery = useQuery({
    queryKey: ['quiz_attempts', profileId],
    queryFn: () => fetchQuizAttempts(profileId as string),
    enabled,
  })
  const modulesWithQuizQuery = useQuery({
    queryKey: ['modules_with_quiz'],
    queryFn: fetchModulesWithQuiz,
    enabled,
  })

  const isLoading =
    !enabled ||
    modulesQuery.isLoading ||
    lessonsQuery.isLoading ||
    progressQuery.isLoading ||
    quizQuery.isLoading ||
    modulesWithQuizQuery.isLoading
  const isError =
    modulesQuery.isError ||
    lessonsQuery.isError ||
    progressQuery.isError ||
    quizQuery.isError ||
    modulesWithQuizQuery.isError
  const error =
    modulesQuery.error ??
    lessonsQuery.error ??
    progressQuery.error ??
    quizQuery.error ??
    modulesWithQuizQuery.error

  const modules = modulesQuery.data
  const lessons = lessonsQuery.data
  const progress = progressQuery.data
  const quizAttempts = quizQuery.data
  const modulesWithQuiz = modulesWithQuizQuery.data

  let data: HomeData | undefined
  if (modules && lessons && progress && quizAttempts && modulesWithQuiz) {
    const lessonsByModule = groupByModule(lessons)
    const concludedLessonIds = new Set(
      progress.filter((p) => p.concluida).map((p) => p.lesson_id),
    )
    const quizByModule = summarizeQuiz(quizAttempts)
    // Seam de quiz: moduleId -> aprovado?. `computeUnlockState` é PERMISSIVO na
    // ausência da chave. Só módulos que TÊM teste entram no mapa: os aprovados
    // com `true`, os NÃO aprovados com `false` (para travar a trilha até passar).
    // Módulo sem questões não entra => não bloqueia.
    const quizPassedByModule: Record<string, boolean> = {}
    for (const moduleId of modulesWithQuiz) {
      quizPassedByModule[moduleId] = quizByModule[moduleId]?.passed ?? false
    }
    const unlockState = computeUnlockState({
      modules,
      lessonsByModule,
      concludedLessonIds,
      quizPassedByModule,
    })
    data = {
      modules,
      lessonsByModule,
      concludedLessonIds,
      unlockState,
      quizByModule,
    }
  }

  return { data, isLoading, isError, error }
}
