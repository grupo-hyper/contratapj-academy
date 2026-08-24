/**
 * useQuiz — camada de dados do motor de teste (Task 4.2).
 *
 * Responsabilidade ÚNICA: buscar as questões do módulo (+ alternativas SEM
 * gabarito) e as tentativas do usuário, e expor a mutation que SUBMETE as
 * respostas à RPC `submit_quiz`. Este hook NÃO corrige o quiz — a correção e as
 * travas (>=80%, máx 3 tentativas, cooldown 24h) são autoritativas no servidor
 * (ver `supabase/migrations/0004_quiz.sql`). O cliente NUNCA vê `correta`.
 *
 * SHUFFLE, NÃO SAMPLE: o servidor corrige sobre TODAS as questões do módulo
 * (denominador = total de questões; questão sem resposta conta como errada).
 * Portanto o cliente apresenta e envia TODAS as questões — só embaralha a ORDEM
 * de exibição das questões e das alternativas (cosmético). Amostrar um
 * subconjunto tornaria a nota inatingível. A amostragem server-authoritative
 * (seleção por-tentativa, à prova de cola) foi deliberadamente adiada — depende
 * do banco de questões da Fase 6/CMS.
 *
 * Fetch das alternativas: SEMPRE pela view `question_options_public` (id,
 * question_id, texto) — NUNCA pela tabela base `question_options` (que expõe
 * `correta`). RLS libera questões só de módulos publicados.
 *
 * quiz_attempts pode não existir ainda no remoto (migration 0004 não aplicada):
 * como em useHomeData/useLesson, tratamos `PGRST205` degradando para "sem
 * tentativas" em vez de derrubar a página.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type {
  Question,
  QuestionOptionPublic,
  QuizAnswers,
  QuizAttempt,
  QuizResult,
} from '../../types/content'
import {
  evaluateAttemptGate,
  type AttemptGate,
} from './quizRules'

/** Uma questão com suas alternativas públicas (para render). */
export interface QuizQuestion {
  question: Question
  options: QuestionOptionPublic[]
}

/**
 * Embaralho Fisher–Yates sobre uma CÓPIA (não muta a entrada). Determinístico o
 * suficiente para UX (Math.random); a ordem não tem valor de segurança.
 */
function shuffle<T>(items: readonly T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

async function fetchQuizQuestions(moduleId: string): Promise<QuizQuestion[]> {
  // 1) Questões do módulo. `questions` não tem coluna `ordem`; ordenamos por
  //    created_at para uma base estável antes de embaralhar.
  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select('*')
    .eq('module_id', moduleId)
    .order('created_at', { ascending: true })
  if (qErr) throw qErr

  const qs = (questions ?? []) as Question[]
  if (qs.length === 0) return []

  // 2) Alternativas — SEMPRE pela view pública (sem `correta`).
  const questionIds = qs.map((q) => q.id)
  const { data: options, error: oErr } = await supabase
    .from('question_options_public')
    .select('*')
    .in('question_id', questionIds)
  if (oErr) throw oErr

  const opts = (options ?? []) as QuestionOptionPublic[]
  const byQuestion: Record<string, QuestionOptionPublic[]> = {}
  for (const o of opts) {
    ;(byQuestion[o.question_id] ??= []).push(o)
  }

  // 3) Agrupa e embaralha: ordem das questões E das alternativas (cosmético).
  //    Embaralha UMA vez no fetch (não a cada render) para estabilidade.
  return shuffle(qs).map((question) => ({
    question,
    options: shuffle(byQuestion[question.id] ?? []),
  }))
}

async function fetchAttempts(
  profileId: string,
  moduleId: string,
): Promise<QuizAttempt[]> {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('profile_id', profileId)
    .eq('module_id', moduleId)
  if (error) {
    // PGRST205 = tabela ausente no schema cache (0004 ainda não aplicada no
    // remoto). Degrada para "sem tentativas" — mesma tática de useHomeData.
    if (error.code === 'PGRST205') {
      console.error(
        '[quiz] tabela quiz_attempts ausente (aplicar supabase/migrations/0004_quiz.sql):',
        error.message,
      )
      return []
    }
    throw error
  }
  return (data ?? []) as QuizAttempt[]
}

export interface UseQuizDataResult {
  questions: QuizQuestion[] | undefined
  attempts: QuizAttempt[] | undefined
  /** Gate de tentativas derivado (espelha a RPC) para UX. undefined enquanto carrega. */
  gate: AttemptGate | undefined
  isLoading: boolean
  isError: boolean
  error: unknown
}

/**
 * Busca questões (embaralhadas) + tentativas do usuário e deriva o `gate`.
 */
export function useQuizData(
  moduleId: string | undefined,
  profileId: string | undefined,
): UseQuizDataResult {
  const enabled = Boolean(moduleId && profileId)

  const questionsQuery = useQuery({
    queryKey: ['quiz_questions', moduleId],
    // Embaralho no queryFn: estável entre re-renders (só refaz no refetch).
    queryFn: () => fetchQuizQuestions(moduleId as string),
    enabled,
  })

  const attemptsQuery = useQuery({
    queryKey: ['quiz_attempts_one', profileId, moduleId],
    queryFn: () => fetchAttempts(profileId as string, moduleId as string),
    enabled,
  })

  const attempts = attemptsQuery.data
  const gate = attempts ? evaluateAttemptGate(attempts, new Date()) : undefined

  return {
    questions: questionsQuery.data,
    attempts,
    gate,
    isLoading: !enabled || questionsQuery.isLoading || attemptsQuery.isLoading,
    isError: questionsQuery.isError || attemptsQuery.isError,
    error: questionsQuery.error ?? attemptsQuery.error,
  }
}

// ---------------------------------------------------------------------------
// Mutation: submissão à RPC submit_quiz
// ---------------------------------------------------------------------------

/** Códigos SQLSTATE que a RPC levanta (ver 0004_quiz.sql). */
export type QuizRejectionCode =
  | 'unauthenticated' // 42501
  | 'unavailable' // P0002 módulo indisponível/não publicado
  | 'cap' // P0003 tentativas esgotadas
  | 'cooldown' // P0004 cooldown ativo
  | 'no_questions' // P0005 módulo sem questões
  | 'unknown'

/**
 * Rejeição TIPADA que a UI pode ramificar sem tocar no texto PT-BR da mensagem.
 * `nextAllowedAt` só vem no cooldown (parseado de `error.details`, ISO UTC).
 */
export interface QuizRejection {
  kind: 'rejection'
  code: QuizRejectionCode
  nextAllowedAt: Date | null
  /** Mensagem original (para log/fallback), NUNCA usada para ramificar lógica. */
  message: string
}

/** Erro do supabase-js: PostgrestError tem `.code` (SQLSTATE) e `.details`. */
interface PostgrestErrorLike {
  code?: string
  details?: string
  message?: string
}

function toRejection(err: PostgrestErrorLike): QuizRejection {
  const code = err.code
  let kind: QuizRejectionCode
  let nextAllowedAt: Date | null = null

  switch (code) {
    case 'P0002':
      kind = 'unavailable'
      break
    case 'P0003':
      kind = 'cap'
      break
    case 'P0004': {
      kind = 'cooldown'
      // O instante liberado vem em `details` como ISO-8601 UTC. Parseamos ISSO,
      // não a mensagem. Se falhar, deixamos null (a UI mostra estado genérico).
      if (err.details) {
        const parsed = new Date(err.details)
        if (!Number.isNaN(parsed.getTime())) nextAllowedAt = parsed
      }
      break
    }
    case 'P0005':
      kind = 'no_questions'
      break
    case '42501':
      // Não deveria acontecer dentro de RequireRole; tratamos como genérico.
      kind = 'unauthenticated'
      break
    default:
      kind = 'unknown'
  }

  return {
    kind: 'rejection',
    code: kind,
    nextAllowedAt,
    message: err.message ?? 'Erro ao enviar o teste.',
  }
}

export interface UseSubmitQuizResult {
  submit: (answers: QuizAnswers) => void
  isSubmitting: boolean
  /** Resultado agregado da última submissão bem-sucedida (ou undefined). */
  result: QuizResult | undefined
  /** Rejeição tipada da última submissão barrada (ou null). */
  rejection: QuizRejection | null
  /** Reseta o estado da mutation (limpa result/rejection). */
  reset: () => void
}

/**
 * Submete as respostas à RPC `submit_quiz`. No sucesso, invalida as tentativas
 * locais (para o gate re-derivar) E a query de tentativas da Home
 * (`['quiz_attempts', profileId]`, ver useHomeData) para a trilha atualizar
 * quando o aluno é aprovado. Erros da RPC viram uma `QuizRejection` tipada.
 */
export function useSubmitQuiz(
  moduleId: string | undefined,
  profileId: string | undefined,
): UseSubmitQuizResult {
  const queryClient = useQueryClient()

  const mutation = useMutation<QuizResult, QuizRejection, QuizAnswers>({
    mutationFn: async (answers: QuizAnswers) => {
      const { data, error } = await supabase.rpc('submit_quiz', {
        p_module_id: moduleId as string,
        p_answers: answers,
      })
      if (error) {
        // Lança a rejeição TIPADA (react-query a expõe em `mutation.error`).
        throw toRejection(error as PostgrestErrorLike)
      }
      return data as QuizResult
    },
    onSuccess: () => {
      // Tentativas locais (re-deriva o gate desta página) + a query de
      // tentativas da Home (mesma chave usada em useHomeData) para a trilha
      // refletir a aprovação.
      void queryClient.invalidateQueries({
        queryKey: ['quiz_attempts_one', profileId, moduleId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['quiz_attempts', profileId],
      })
    },
  })

  return {
    submit: (answers: QuizAnswers) => mutation.mutate(answers),
    isSubmitting: mutation.isPending,
    result: mutation.data,
    rejection: mutation.error ?? null,
    reset: () => mutation.reset(),
  }
}
