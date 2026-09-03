/**
 * useManagerClasses — camada de dados do Painel do Gestor, bloco G1 (turmas + meta).
 *
 * Responsabilidade: buscar as TURMAS do gestor logado (com a meta de ritmo de cada
 * uma, quando definida) e expor as mutations de gestão:
 *   - criar turma (insert em `classes`, nascendo como do gestor);
 *   - renomear turma (update em `classes`);
 *   - excluir turma (delete em `classes` — cascata apaga matrículas e meta via FK);
 *   - definir/editar a meta de ritmo (upsert em `class_goals`, uma por turma).
 *
 * RLS (0006): o gestor só lê/escreve as PRÓPRIAS turmas (gestor_id = auth.uid()) e
 * as metas dessas turmas. Ainda assim filtramos por `gestor_id` explicitamente
 * (previsível/testável, mesmo padrão de `useGoals`).
 *
 * Invalidação: além das chaves do próprio painel, invalidamos as chaves do painel
 * do ALUNO (`classes_for_goals`, `class_goals`) para que, ao mudar uma meta, o
 * ritmo do aluno reflita assim que ele voltar.
 *
 * Degradação: tabelas novas podem não existir no remoto (migration 0006 não
 * aplicada) → PGRST205 → degrada para vazio em vez de quebrar a tela.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

/** Turma do gestor com a meta de ritmo embutida (null = turma sem meta). */
export interface ManagerClass {
  id: string
  nome: string
  created_at: string
  modulesPerWeek: number | null
}

interface ClassRow {
  id: string
  nome: string
  created_at: string
}

interface ClassGoalRow {
  class_id: string
  modules_per_week: number
}

/** `data === null` + este code = tabela ausente (migration 0006 não aplicada). */
function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST205'
}

async function fetchClasses(gestorId: string): Promise<ClassRow[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('id,nome,created_at')
    .eq('gestor_id', gestorId)
    .order('created_at', { ascending: true })
  if (error) {
    if (isMissingTable(error)) {
      console.error(
        '[manager] tabela classes ausente (aplicar supabase/migrations/0006_goals.sql):',
        error.message,
      )
      return []
    }
    throw error
  }
  return (data ?? []) as ClassRow[]
}

async function fetchClassGoals(): Promise<ClassGoalRow[]> {
  const { data, error } = await supabase
    .from('class_goals')
    .select('class_id,modules_per_week')
  if (error) {
    if (isMissingTable(error)) {
      console.error(
        '[manager] tabela class_goals ausente (aplicar supabase/migrations/0006_goals.sql):',
        error.message,
      )
      return []
    }
    throw error
  }
  return (data ?? []) as ClassGoalRow[]
}

async function createClass(gestorId: string, nome: string): Promise<void> {
  const { error } = await supabase
    .from('classes')
    .insert({ nome, gestor_id: gestorId })
  if (error) throw error
}

async function renameClass(id: string, nome: string): Promise<void> {
  const { error } = await supabase.from('classes').update({ nome }).eq('id', id)
  if (error) throw error
}

async function deleteClass(id: string): Promise<void> {
  const { error } = await supabase.from('classes').delete().eq('id', id)
  if (error) throw error
}

async function setGoal(classId: string, modulesPerWeek: number): Promise<void> {
  const { error } = await supabase
    .from('class_goals')
    .upsert(
      { class_id: classId, modules_per_week: modulesPerWeek },
      { onConflict: 'class_id' },
    )
  if (error) throw error
}

export interface UseManagerClassesResult {
  classes: ManagerClass[]
  isLoading: boolean
  isError: boolean
  error: unknown
  createClass: (nome: string) => void
  renameClass: (id: string, nome: string) => void
  deleteClass: (id: string) => void
  setGoal: (classId: string, modulesPerWeek: number) => void
  /** true enquanto QUALQUER mutation (criar/renomear/excluir/meta) está em voo. */
  isMutating: boolean
  /** true se a última mutation falhou (para feedback inline). */
  isMutationError: boolean
}

/**
 * Hook público consumido pela ManagerPage. Recebe o `gestorId` (== profile.id do
 * gestor logado); enquanto ausente as queries ficam desabilitadas.
 */
export function useManagerClasses(
  gestorId: string | undefined,
): UseManagerClassesResult {
  const queryClient = useQueryClient()
  const enabled = Boolean(gestorId)

  const classesQuery = useQuery({
    queryKey: ['manager_classes', gestorId],
    queryFn: () => fetchClasses(gestorId as string),
    enabled,
  })
  const goalsQuery = useQuery({
    queryKey: ['manager_class_goals', gestorId],
    queryFn: fetchClassGoals,
    enabled,
  })

  /** Invalida o painel do gestor E o do aluno (o ritmo depende das metas/turmas). */
  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: ['manager_classes', gestorId] })
    void queryClient.invalidateQueries({
      queryKey: ['manager_class_goals', gestorId],
    })
    void queryClient.invalidateQueries({ queryKey: ['classes_for_goals'] })
    void queryClient.invalidateQueries({ queryKey: ['class_goals'] })
  }

  const createMutation = useMutation({
    mutationFn: (nome: string) => createClass(gestorId as string, nome),
    onSuccess: invalidateAll,
  })
  const renameMutation = useMutation({
    mutationFn: (vars: { id: string; nome: string }) =>
      renameClass(vars.id, vars.nome),
    onSuccess: invalidateAll,
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteClass(id),
    onSuccess: invalidateAll,
  })
  const goalMutation = useMutation({
    mutationFn: (vars: { classId: string; modulesPerWeek: number }) =>
      setGoal(vars.classId, vars.modulesPerWeek),
    onSuccess: invalidateAll,
  })

  const goalByClass = new Map(
    (goalsQuery.data ?? []).map((g) => [g.class_id, g.modules_per_week]),
  )
  const classes: ManagerClass[] = (classesQuery.data ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    created_at: c.created_at,
    modulesPerWeek: goalByClass.get(c.id) ?? null,
  }))

  return {
    classes,
    isLoading: !enabled || classesQuery.isLoading || goalsQuery.isLoading,
    isError: classesQuery.isError || goalsQuery.isError,
    error: classesQuery.error ?? goalsQuery.error,
    createClass: (nome) => createMutation.mutate(nome),
    renameClass: (id, nome) => renameMutation.mutate({ id, nome }),
    deleteClass: (id) => deleteMutation.mutate(id),
    setGoal: (classId, modulesPerWeek) =>
      goalMutation.mutate({ classId, modulesPerWeek }),
    isMutating:
      createMutation.isPending ||
      renameMutation.isPending ||
      deleteMutation.isPending ||
      goalMutation.isPending,
    isMutationError:
      createMutation.isError ||
      renameMutation.isError ||
      deleteMutation.isError ||
      goalMutation.isError,
  }
}
