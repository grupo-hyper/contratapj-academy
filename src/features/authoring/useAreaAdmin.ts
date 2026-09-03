/**
 * useAreaAdmin — CRUD de ÁREAS pelo admin (F1 de Áreas, Task 8).
 *
 * Responsabilidade ÚNICA: expor as mutations de gestão de áreas (criar/editar/
 * excluir) usadas pelo `AreaManager` do CMS (Task 9, ainda não construído).
 * Não faz leitura — quem lê a lista de áreas é `useAreas` (`src/features/areas/
 * useAreas.ts`), cuja query (`['areas']`) esta hook invalida em toda mutation
 * bem-sucedida, para a Home/hub de áreas refletir a mudança.
 *
 * RLS (0009): a policy `areas_admin_all` libera `for all` em `areas` para quem
 * passa em `public.is_admin()` — só admin pode criar/editar/excluir; aluno/
 * vendedor seguem restritos à leitura de `publicado = true`.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Area } from '../../types/content'

/** Payload de criação de uma área — todos os campos editáveis são exigidos. */
export interface AreaInput {
  nome: string
  slug: string
  descricao: string | null
  capa_url: string | null
  visibilidade: 'publica' | 'restrita'
  ordem: number
  publicado: boolean
}

/** Campos editáveis de uma área pelo AreaManager (tudo exceto id/created_at). */
export type AreaPatch = Partial<Omit<Area, 'id' | 'created_at'>>

async function createArea(input: AreaInput): Promise<void> {
  const { error } = await supabase.from('areas').insert(input)
  if (error) throw error
}

async function updateArea(id: string, patch: AreaPatch): Promise<void> {
  const { error } = await supabase.from('areas').update(patch).eq('id', id)
  if (error) throw error
}

async function deleteArea(id: string): Promise<void> {
  const { error } = await supabase.from('areas').delete().eq('id', id)
  if (error) throw error
}

export interface UseAreaAdminResult {
  createArea: (input: AreaInput) => void
  updateArea: (id: string, patch: AreaPatch) => void
  deleteArea: (id: string) => void
  /** true enquanto QUALQUER mutation está em voo. */
  isMutating: boolean
  /** true se a última mutation falhou (para feedback inline). */
  isMutationError: boolean
}

/** Hook público consumido pelo AreaManager (CMS do admin). Sem parâmetros —
 * acesso é todo-ou-nada, gated pela RLS `areas_admin_all` (não por um id de
 * dono, como em `useManagerClasses`). */
export function useAreaAdmin(): UseAreaAdminResult {
  const queryClient = useQueryClient()

  /** Invalida a lista de áreas lida por `useAreas` (Home/hub de áreas). */
  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: ['areas'] })
  }

  const createAreaMutation = useMutation({
    mutationFn: (input: AreaInput) => createArea(input),
    onSuccess: invalidateAll,
  })
  const updateAreaMutation = useMutation({
    mutationFn: (vars: { id: string; patch: AreaPatch }) =>
      updateArea(vars.id, vars.patch),
    onSuccess: invalidateAll,
  })
  const deleteAreaMutation = useMutation({
    mutationFn: (id: string) => deleteArea(id),
    onSuccess: invalidateAll,
  })

  const mutations = [createAreaMutation, updateAreaMutation, deleteAreaMutation]

  return {
    createArea: (input) => createAreaMutation.mutate(input),
    updateArea: (id, patch) => updateAreaMutation.mutate({ id, patch }),
    deleteArea: (id) => deleteAreaMutation.mutate(id),
    isMutating: mutations.some((m) => m.isPending),
    isMutationError: mutations.some((m) => m.isError),
  }
}
