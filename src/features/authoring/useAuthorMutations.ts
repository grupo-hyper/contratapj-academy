/**
 * useAuthorMutations — mutations de gestão de MÓDULOS e AULAS do CMS do autor (F2).
 *
 * Cobre: criar/editar/excluir módulo; criar/excluir aula; reordenar módulos e
 * aulas com ↑↓ (swap). A EDIÇÃO de aula NÃO mora aqui (é o `useSaveLesson`).
 *
 * RLS (0002): o papel `autor` tem `for all` em `modules`/`lessons` (lê rascunhos,
 * cria/edita/exclui). Excluir módulo remove aulas/quiz em cascata (FK on delete).
 *
 * Reorder sob UNIQUE(ordem): NÃO fazemos dois UPDATEs soltos (colidiriam na
 * constraint no meio do batch). Fazemos UM único `upsert` com as duas linhas de
 * ordem já trocada — a checagem de unicidade roda no fim do statement. Idem
 * lessons (UNIQUE por module_id).
 *
 * Invalidação no sucesso: as chaves do autor (`['author_tree', ...]`) E as do
 * ALUNO (`['modules']`, `['lessons']`, `['modules_with_quiz']` de `useHomeData`)
 * para que a Home/trilha do aluno reflita criação/exclusão/reordenação.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

/** Título padrão de um módulo recém-criado (o autor edita no ModuleEditor). */
const DEFAULT_MODULE_TITLE = 'Novo módulo'
/** Título padrão de uma aula recém-criada (o autor edita no LessonEditor). */
const DEFAULT_LESSON_TITLE = 'Nova aula'

/** Campos editáveis de um módulo pelo ModuleEditor. */
export interface ModulePatch {
  titulo?: string
  descricao?: string | null
  capa_url?: string | null
  publicado?: boolean
}

/** Identidade + ordem de um item, para o swap de reordenação. */
export interface OrderedRef {
  id: string
  ordem: number
}

async function createModule(): Promise<void> {
  // Nova ordem = maior ordem existente + 1 (1 se não houver módulos).
  const { data, error } = await supabase
    .from('modules')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
  if (error) throw error
  const proximaOrdem = (data?.[0]?.ordem ?? 0) + 1
  const { error: insertError } = await supabase.from('modules').insert({
    ordem: proximaOrdem,
    titulo: DEFAULT_MODULE_TITLE,
    publicado: false,
  })
  if (insertError) throw insertError
}

async function updateModule(id: string, patch: ModulePatch): Promise<void> {
  const { error } = await supabase.from('modules').update(patch).eq('id', id)
  if (error) throw error
}

async function deleteModule(id: string): Promise<void> {
  const { error } = await supabase.from('modules').delete().eq('id', id)
  if (error) throw error
}

async function createLesson(moduleId: string): Promise<void> {
  // Nova ordem = maior ordem de aula NO MÓDULO + 1 (1 se não houver aulas).
  const { data, error } = await supabase
    .from('lessons')
    .select('ordem')
    .eq('module_id', moduleId)
    .order('ordem', { ascending: false })
    .limit(1)
  if (error) throw error
  const proximaOrdem = (data?.[0]?.ordem ?? 0) + 1
  const { error: insertError } = await supabase.from('lessons').insert({
    module_id: moduleId,
    ordem: proximaOrdem,
    titulo: DEFAULT_LESSON_TITLE,
    publicado: false,
  })
  if (insertError) throw insertError
}

async function deleteLesson(id: string): Promise<void> {
  const { error } = await supabase.from('lessons').delete().eq('id', id)
  if (error) throw error
}

/** Swap seguro sob UNIQUE(ordem): UM upsert com as duas ordens já trocadas. */
async function reorderModules(a: OrderedRef, b: OrderedRef): Promise<void> {
  const { error } = await supabase.from('modules').upsert([
    { id: a.id, ordem: b.ordem },
    { id: b.id, ordem: a.ordem },
  ])
  if (error) throw error
}

/** Swap seguro sob UNIQUE(module_id, ordem): UM upsert com as ordens trocadas. */
async function reorderLessons(a: OrderedRef, b: OrderedRef): Promise<void> {
  const { error } = await supabase.from('lessons').upsert([
    { id: a.id, ordem: b.ordem },
    { id: b.id, ordem: a.ordem },
  ])
  if (error) throw error
}

export interface UseAuthorMutationsResult {
  createModule: () => void
  updateModule: (id: string, patch: ModulePatch) => void
  deleteModule: (id: string) => void
  createLesson: (moduleId: string) => void
  deleteLesson: (id: string) => void
  reorderModules: (a: OrderedRef, b: OrderedRef) => void
  reorderLessons: (a: OrderedRef, b: OrderedRef) => void
  /** true enquanto QUALQUER mutation está em voo. */
  isMutating: boolean
  /** true se a última mutation falhou (para feedback inline). */
  isMutationError: boolean
}

export function useAuthorMutations(): UseAuthorMutationsResult {
  const queryClient = useQueryClient()

  /** Invalida a árvore do autor E as queries do aluno (Home/trilha). */
  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: ['author_tree', 'modules'] })
    void queryClient.invalidateQueries({ queryKey: ['author_tree', 'lessons'] })
    void queryClient.invalidateQueries({ queryKey: ['modules'] })
    void queryClient.invalidateQueries({ queryKey: ['lessons'] })
    void queryClient.invalidateQueries({ queryKey: ['modules_with_quiz'] })
  }

  const createModuleMutation = useMutation({
    mutationFn: createModule,
    onSuccess: invalidateAll,
  })
  const updateModuleMutation = useMutation({
    mutationFn: (vars: { id: string; patch: ModulePatch }) =>
      updateModule(vars.id, vars.patch),
    onSuccess: invalidateAll,
  })
  const deleteModuleMutation = useMutation({
    mutationFn: (id: string) => deleteModule(id),
    onSuccess: invalidateAll,
  })
  const createLessonMutation = useMutation({
    mutationFn: (moduleId: string) => createLesson(moduleId),
    onSuccess: invalidateAll,
  })
  const deleteLessonMutation = useMutation({
    mutationFn: (id: string) => deleteLesson(id),
    onSuccess: invalidateAll,
  })
  const reorderModulesMutation = useMutation({
    mutationFn: (vars: { a: OrderedRef; b: OrderedRef }) =>
      reorderModules(vars.a, vars.b),
    onSuccess: invalidateAll,
  })
  const reorderLessonsMutation = useMutation({
    mutationFn: (vars: { a: OrderedRef; b: OrderedRef }) =>
      reorderLessons(vars.a, vars.b),
    onSuccess: invalidateAll,
  })

  const mutations = [
    createModuleMutation,
    updateModuleMutation,
    deleteModuleMutation,
    createLessonMutation,
    deleteLessonMutation,
    reorderModulesMutation,
    reorderLessonsMutation,
  ]

  return {
    createModule: () => createModuleMutation.mutate(),
    updateModule: (id, patch) => updateModuleMutation.mutate({ id, patch }),
    deleteModule: (id) => deleteModuleMutation.mutate(id),
    createLesson: (moduleId) => createLessonMutation.mutate(moduleId),
    deleteLesson: (id) => deleteLessonMutation.mutate(id),
    reorderModules: (a, b) => reorderModulesMutation.mutate({ a, b }),
    reorderLessons: (a, b) => reorderLessonsMutation.mutate({ a, b }),
    isMutating: mutations.some((m) => m.isPending),
    isMutationError: mutations.some((m) => m.isError),
  }
}
