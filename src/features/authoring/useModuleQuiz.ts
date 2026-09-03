/**
 * useModuleQuiz — camada de dados do editor de QUIZ do módulo no CMS do autor (F3).
 *
 * READ (assimétrico ao aluno): diferente de `useQuiz` (que lê a view pública
 * `question_options_public`, SEM gabarito), o AUTOR lê a TABELA BASE
 * `question_options` para poder exibir/editar qual alternativa é a `correta`.
 * A RLS de 0002 dá ao papel `autor` `for all` em `questions`/`question_options`
 * e permite ler `correta` — sem migration nova.
 *
 * `questions` não tem coluna `ordem` → ordenamos por `created_at` (base estável).
 * As alternativas de todas as questões vêm num único `.in('question_id', …)` e
 * são agrupadas por questão em memória.
 *
 * Mutations: criar/editar/excluir pergunta; criar/editar/excluir alternativa; e
 * marcar UMA correta. Excluir pergunta cascateia as alternativas (FK on delete).
 *
 * setCorrectOption faz DUAS chamadas: zera `correta` de TODAS as alternativas da
 * pergunta e depois marca a escolhida. Não há constraint de unicidade que colida
 * no meio (ao contrário de `ordem` em módulos/aulas), então dois updates soltos
 * são seguros e legíveis.
 *
 * Invalidação no sucesso: a chave própria (`['module_quiz', moduleId]`) + a do
 * ALUNO (`['quiz_questions', moduleId]`, de `useQuiz`) + a da Home do aluno
 * (`['modules_with_quiz']`), pois criar/excluir questões muda se o módulo tem
 * quiz.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Question, QuestionOption } from '../../types/content'

/** Alternativa no editor do autor (com `correta`, ao contrário do aluno). */
export interface EditableOption {
  id: string
  texto: string
  correta: boolean
}

/** Pergunta com suas alternativas (base, com gabarito) para o editor. */
export interface EditableQuestion {
  id: string
  enunciado: string
  options: EditableOption[]
}

async function fetchModuleQuiz(moduleId: string): Promise<EditableQuestion[]> {
  // 1) Questões do módulo. `questions` não tem `ordem` → ordena por created_at.
  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select('*')
    .eq('module_id', moduleId)
    .order('created_at', { ascending: true })
  if (qErr) throw qErr

  const qs = (questions ?? []) as Question[]
  if (qs.length === 0) return []

  // 2) Alternativas — TABELA BASE `question_options` (traz `correta`; o autor
  //    tem RLS pra ler). Um único fetch por `.in(...)`, agrupado em memória.
  const questionIds = qs.map((q) => q.id)
  const { data: options, error: oErr } = await supabase
    .from('question_options')
    .select('*')
    .in('question_id', questionIds)
    .order('created_at', { ascending: true })
  if (oErr) throw oErr

  const opts = (options ?? []) as QuestionOption[]
  const byQuestion: Record<string, EditableOption[]> = {}
  for (const o of opts) {
    ;(byQuestion[o.question_id] ??= []).push({
      id: o.id,
      texto: o.texto,
      correta: o.correta,
    })
  }

  return qs.map((q) => ({
    id: q.id,
    enunciado: q.enunciado,
    options: byQuestion[q.id] ?? [],
  }))
}

async function createQuestion(
  moduleId: string,
  enunciado: string,
): Promise<void> {
  const { error } = await supabase
    .from('questions')
    .insert({ module_id: moduleId, enunciado })
  if (error) throw error
}

async function updateQuestion(id: string, enunciado: string): Promise<void> {
  const { error } = await supabase
    .from('questions')
    .update({ enunciado })
    .eq('id', id)
  if (error) throw error
}

async function deleteQuestion(id: string): Promise<void> {
  // Cascade nas alternativas via FK on delete (0002_content.sql).
  const { error } = await supabase.from('questions').delete().eq('id', id)
  if (error) throw error
}

async function createOption(
  questionId: string,
  texto: string,
): Promise<void> {
  const { error } = await supabase
    .from('question_options')
    .insert({ question_id: questionId, texto, correta: false })
  if (error) throw error
}

async function updateOptionText(id: string, texto: string): Promise<void> {
  const { error } = await supabase
    .from('question_options')
    .update({ texto })
    .eq('id', id)
  if (error) throw error
}

async function deleteOption(id: string): Promise<void> {
  const { error } = await supabase.from('question_options').delete().eq('id', id)
  if (error) throw error
}

/**
 * Marca UMA alternativa como correta: zera todas da pergunta e depois marca a
 * escolhida. Duas chamadas sequenciais; sem constraint que colida no meio.
 */
async function setCorrectOption(
  questionId: string,
  optionId: string,
): Promise<void> {
  const { error: clearErr } = await supabase
    .from('question_options')
    .update({ correta: false })
    .eq('question_id', questionId)
  if (clearErr) throw clearErr
  const { error: setErr } = await supabase
    .from('question_options')
    .update({ correta: true })
    .eq('id', optionId)
  if (setErr) throw setErr
}

export interface UseModuleQuizResult {
  questions: EditableQuestion[]
  isLoading: boolean
  isError: boolean
  createQuestion: (enunciado: string) => void
  updateQuestion: (id: string, enunciado: string) => void
  deleteQuestion: (id: string) => void
  createOption: (questionId: string, texto: string) => void
  updateOptionText: (id: string, texto: string) => void
  deleteOption: (id: string) => void
  setCorrectOption: (questionId: string, optionId: string) => void
  /** true enquanto QUALQUER mutation está em voo. */
  isMutating: boolean
  /** true se a última mutation falhou (feedback inline). */
  isMutationError: boolean
}

export function useModuleQuiz(
  moduleId: string | undefined,
): UseModuleQuizResult {
  const queryClient = useQueryClient()
  const enabled = Boolean(moduleId)

  const query = useQuery({
    queryKey: ['module_quiz', moduleId],
    queryFn: () => fetchModuleQuiz(moduleId as string),
    enabled,
  })

  /** Invalida a query própria + a do aluno (useQuiz) + a Home do aluno. */
  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: ['module_quiz', moduleId] })
    void queryClient.invalidateQueries({
      queryKey: ['quiz_questions', moduleId],
    })
    void queryClient.invalidateQueries({ queryKey: ['modules_with_quiz'] })
  }

  const createQuestionMutation = useMutation({
    mutationFn: (enunciado: string) =>
      createQuestion(moduleId as string, enunciado),
    onSuccess: invalidateAll,
  })
  const updateQuestionMutation = useMutation({
    mutationFn: (vars: { id: string; enunciado: string }) =>
      updateQuestion(vars.id, vars.enunciado),
    onSuccess: invalidateAll,
  })
  const deleteQuestionMutation = useMutation({
    mutationFn: (id: string) => deleteQuestion(id),
    onSuccess: invalidateAll,
  })
  const createOptionMutation = useMutation({
    mutationFn: (vars: { questionId: string; texto: string }) =>
      createOption(vars.questionId, vars.texto),
    onSuccess: invalidateAll,
  })
  const updateOptionTextMutation = useMutation({
    mutationFn: (vars: { id: string; texto: string }) =>
      updateOptionText(vars.id, vars.texto),
    onSuccess: invalidateAll,
  })
  const deleteOptionMutation = useMutation({
    mutationFn: (id: string) => deleteOption(id),
    onSuccess: invalidateAll,
  })
  const setCorrectOptionMutation = useMutation({
    mutationFn: (vars: { questionId: string; optionId: string }) =>
      setCorrectOption(vars.questionId, vars.optionId),
    onSuccess: invalidateAll,
  })

  const mutations = [
    createQuestionMutation,
    updateQuestionMutation,
    deleteQuestionMutation,
    createOptionMutation,
    updateOptionTextMutation,
    deleteOptionMutation,
    setCorrectOptionMutation,
  ]

  return {
    questions: query.data ?? [],
    isLoading: enabled && query.isLoading,
    isError: query.isError,
    createQuestion: (enunciado) => createQuestionMutation.mutate(enunciado),
    updateQuestion: (id, enunciado) =>
      updateQuestionMutation.mutate({ id, enunciado }),
    deleteQuestion: (id) => deleteQuestionMutation.mutate(id),
    createOption: (questionId, texto) =>
      createOptionMutation.mutate({ questionId, texto }),
    updateOptionText: (id, texto) =>
      updateOptionTextMutation.mutate({ id, texto }),
    deleteOption: (id) => deleteOptionMutation.mutate(id),
    setCorrectOption: (questionId, optionId) =>
      setCorrectOptionMutation.mutate({ questionId, optionId }),
    isMutating: mutations.some((m) => m.isPending),
    isMutationError: mutations.some((m) => m.isError),
  }
}
