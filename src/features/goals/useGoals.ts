/**
 * useGoals — camada de dados do painel de RITMO do aluno (Task 5.2, Fase 5).
 *
 * Responsabilidade ÚNICA: buscar (via react-query + Supabase) o que o painel de
 * metas do aluno precisa e DERIVAR o modelo pronto para a UI:
 *   - a MATRÍCULA do aluno (enrollments) → turma + `created_at` (marco zero do
 *     ritmo, a partir do qual medimos o progresso esperado);
 *   - a META da turma (class_goals) → `modules_per_week` (o ritmo alvo);
 *   - os MÓDULOS CONCLUÍDOS pelo aluno (quiz_attempts aprovados, distintos) —
 *     mesmo sinal de "módulo concluído" da trilha da Home (aprovar o teste);
 *   - o total de módulos publicados (para dar contexto e capar o esperado).
 *
 * DECISÃO DE PRODUTO (0006): a meta é SÓ o RITMO GLOBAL (modules_per_week). Não
 * há prazo por módulo nem meta individual. O status "em dia / atrasado / adiantado"
 * é calculado AQUI no app (não no banco) por `computeGoalStatus`, comparando os
 * módulos concluídos com o esperado (= modules_per_week × semanas desde a matrícula).
 *
 * RLS (0006): o aluno lê APENAS as próprias matrículas, as turmas em que está
 * matriculado e a meta dessas turmas. Ainda assim filtramos por `profile_id` para
 * não depender só da política e manter o teste previsível.
 *
 * Degradação: tabelas novas (enrollments/classes/class_goals) podem não existir
 * no schema remoto ainda → PostgREST devolve PGRST205 → degradamos para vazio
 * (mesmo padrão de useHomeData/useCertificates), sem quebrar a tela.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { QuizAttempt } from '../../types/content'

/** Uma semana em milissegundos (base do cálculo de ritmo). */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Matrícula do aluno numa turma (subset de `enrollments`). */
interface Enrollment {
  id: string
  class_id: string
  created_at: string
}

/** Turma (subset de `classes`). */
interface ClassRow {
  id: string
  nome: string
}

/** Meta da turma (subset de `class_goals`). */
interface ClassGoalRow {
  class_id: string
  modules_per_week: number
}

/** `data === null` + este code = tabela ausente (migration 0006 não aplicada). */
function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST205'
}

async function fetchEnrollments(profileId: string): Promise<Enrollment[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('id,class_id,created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: true })
  if (error) {
    if (isMissingTable(error)) {
      console.error(
        '[goals] tabela enrollments ausente (aplicar supabase/migrations/0006_goals.sql):',
        error.message,
      )
      return []
    }
    throw error
  }
  return (data ?? []) as Enrollment[]
}

/** Turmas visíveis ao aluno (a RLS já limita às matriculadas). */
async function fetchClasses(): Promise<ClassRow[]> {
  const { data, error } = await supabase.from('classes').select('id,nome')
  if (error) {
    if (isMissingTable(error)) {
      console.error(
        '[goals] tabela classes ausente (aplicar supabase/migrations/0006_goals.sql):',
        error.message,
      )
      return []
    }
    throw error
  }
  return (data ?? []) as ClassRow[]
}

/** Metas das turmas visíveis (a RLS já limita às do aluno). */
async function fetchClassGoals(): Promise<ClassGoalRow[]> {
  const { data, error } = await supabase
    .from('class_goals')
    .select('class_id,modules_per_week')
  if (error) {
    if (isMissingTable(error)) {
      console.error(
        '[goals] tabela class_goals ausente (aplicar supabase/migrations/0006_goals.sql):',
        error.message,
      )
      return []
    }
    throw error
  }
  return (data ?? []) as ClassGoalRow[]
}

/** Tentativas de quiz do aluno (para contar módulos concluídos = aprovados). */
async function fetchQuizAttempts(profileId: string): Promise<QuizAttempt[]> {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('profile_id', profileId)
  if (error) {
    if (isMissingTable(error)) {
      console.error(
        '[goals] tabela quiz_attempts ausente (aplicar supabase/migrations/0004_quiz.sql):',
        error.message,
      )
      return []
    }
    throw error
  }
  return (data ?? []) as QuizAttempt[]
}

/** Total de módulos publicados (contexto/cap do esperado). */
async function fetchPublishedModuleCount(): Promise<number> {
  const { count, error } = await supabase
    .from('modules')
    .select('id', { count: 'exact', head: true })
    .eq('publicado', true)
  if (error) {
    if (isMissingTable(error)) {
      console.error(
        '[goals] tabela modules ausente (aplicar supabase/migrations/0002_content.sql):',
        error.message,
      )
      return 0
    }
    throw error
  }
  return count ?? 0
}

/** Nº de módulos DISTINTOS em que o aluno foi aprovado (= módulos concluídos). */
function countConcludedModules(attempts: QuizAttempt[]): number {
  const passed = new Set<string>()
  for (const a of attempts) {
    if (a.aprovado) passed.add(a.module_id)
  }
  return passed.size
}

/** Status do ritmo do aluno. */
export type GoalStatus = 'em_dia' | 'atrasado' | 'adiantado'

export interface GoalComputation {
  /** Semanas (fracionárias) desde a matrícula; nunca negativo. */
  weeksElapsed: number
  /** Esperado no ritmo alvo até agora (float, capado no total de módulos). */
  expectedModules: number
  /** Módulos concluídos (quiz aprovado, distintos). */
  completedModules: number
  status: GoalStatus
  /** Quantos módulos INTEIROS faltam para ficar em dia (0 se em dia/adiantado). */
  modulesBehind: number
}

/**
 * Núcleo PURO do painel (testável com `now` injetado): dado o ritmo alvo, o marco
 * zero (matrícula) e os módulos concluídos, decide em dia / atrasado / adiantado.
 *
 * Regra (0006): esperado = modules_per_week × semanas desde a matrícula (capado no
 * total de módulos publicados). O aluno está:
 *   - ATRASADO  quando concluiu MENOS que o esperado;
 *   - ADIANTADO quando concluiu ao menos 1 módulo inteiro A MAIS que o esperado;
 *   - EM DIA     no meio (alcançou o esperado, mas sem 1 módulo inteiro de folga).
 */
export function computeGoalStatus(params: {
  modulesPerWeek: number
  enrolledAtISO: string
  completedModules: number
  totalModules: number
  now: Date
}): GoalComputation {
  const { modulesPerWeek, enrolledAtISO, completedModules, totalModules, now } =
    params

  const enrolledMs = new Date(enrolledAtISO).getTime()
  const elapsedMs = Math.max(0, now.getTime() - enrolledMs)
  const weeksElapsed = elapsedMs / WEEK_MS

  const rawExpected = modulesPerWeek * weeksElapsed
  // Cap no total de módulos publicados: não faz sentido "esperar" mais módulos do
  // que existem (cap 0 => sem cap, ex.: contagem indisponível).
  const expectedModules =
    totalModules > 0 ? Math.min(rawExpected, totalModules) : rawExpected

  let status: GoalStatus
  if (completedModules < expectedModules) status = 'atrasado'
  else if (completedModules >= expectedModules + 1) status = 'adiantado'
  else status = 'em_dia'

  const modulesBehind =
    status === 'atrasado'
      ? Math.max(1, Math.ceil(expectedModules - completedModules))
      : 0

  return {
    weeksElapsed,
    expectedModules,
    completedModules,
    status,
    modulesBehind,
  }
}

export interface GoalsModel {
  /** true quando o aluno está numa turma COM meta de ritmo definida. */
  hasGoal: boolean
  className: string | null
  modulesPerWeek: number | null
  /** Marco zero do ritmo (UTC ISO); exibição em BRT na página. */
  enrolledAtISO: string | null
  totalModules: number
  completedModules: number
  /** Só presente quando `hasGoal`; o cálculo de status já resolvido. */
  computation: GoalComputation | null
}

export interface UseGoalsResult {
  model: GoalsModel
  isLoading: boolean
  isError: boolean
  error: unknown
}

/**
 * Hook público consumido pela GoalsPage. Recebe o `profileId` (== user.id) para
 * escopar matrícula/progresso; enquanto ausente as queries ficam desabilitadas.
 *
 * `now` é injetável para teste; em produção usa o relógio real.
 */
export function useGoals(
  profileId: string | undefined,
  now: Date = new Date(),
): UseGoalsResult {
  const enabled = Boolean(profileId)

  const enrollmentsQuery = useQuery({
    queryKey: ['enrollments', profileId],
    queryFn: () => fetchEnrollments(profileId as string),
    enabled,
  })
  const classesQuery = useQuery({
    queryKey: ['classes_for_goals'],
    queryFn: fetchClasses,
    enabled,
  })
  const goalsQuery = useQuery({
    queryKey: ['class_goals'],
    queryFn: fetchClassGoals,
    enabled,
  })
  const quizQuery = useQuery({
    queryKey: ['quiz_attempts', profileId],
    queryFn: () => fetchQuizAttempts(profileId as string),
    enabled,
  })
  const moduleCountQuery = useQuery({
    queryKey: ['published_module_count'],
    queryFn: fetchPublishedModuleCount,
    enabled,
  })

  const isLoading =
    !enabled ||
    enrollmentsQuery.isLoading ||
    classesQuery.isLoading ||
    goalsQuery.isLoading ||
    quizQuery.isLoading ||
    moduleCountQuery.isLoading
  const isError =
    enrollmentsQuery.isError ||
    classesQuery.isError ||
    goalsQuery.isError ||
    quizQuery.isError ||
    moduleCountQuery.isError
  const error =
    enrollmentsQuery.error ??
    classesQuery.error ??
    goalsQuery.error ??
    quizQuery.error ??
    moduleCountQuery.error

  const emptyModel: GoalsModel = {
    hasGoal: false,
    className: null,
    modulesPerWeek: null,
    enrolledAtISO: null,
    totalModules: 0,
    completedModules: 0,
    computation: null,
  }

  const enrollments = enrollmentsQuery.data
  const classes = classesQuery.data
  const goals = goalsQuery.data
  const attempts = quizQuery.data
  const totalModules = moduleCountQuery.data

  let model = emptyModel
  if (enrollments && classes && goals && attempts && totalModules !== undefined) {
    const completedModules = countConcludedModules(attempts)
    const nameByClass = new Map(classes.map((c) => [c.id, c.nome]))
    const goalByClass = new Map(goals.map((g) => [g.class_id, g.modules_per_week]))

    // Matrícula "ativa" p/ o ritmo: a mais antiga (marco zero) que TEM meta; se
    // nenhuma matrícula tem meta, usa a mais antiga só para exibir "sem meta".
    // (enrollments já vem ordenado por created_at asc.)
    const withGoal = enrollments.find((e) => goalByClass.has(e.class_id))
    const primary = withGoal ?? enrollments[0]

    if (primary) {
      const modulesPerWeek = goalByClass.get(primary.class_id) ?? null
      const hasGoal = modulesPerWeek !== null
      model = {
        hasGoal,
        className: nameByClass.get(primary.class_id) ?? null,
        modulesPerWeek,
        enrolledAtISO: primary.created_at,
        totalModules,
        completedModules,
        computation: hasGoal
          ? computeGoalStatus({
              modulesPerWeek,
              enrolledAtISO: primary.created_at,
              completedModules,
              totalModules,
              now,
            })
          : null,
      }
    } else {
      model = { ...emptyModel, totalModules, completedModules }
    }
  }

  return { model, isLoading, isError, error }
}
