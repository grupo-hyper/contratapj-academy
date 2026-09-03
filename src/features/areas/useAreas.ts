/**
 * useAreas — camada de dados das Áreas (Task 2, Fase 1 de Áreas).
 *
 * Responsabilidade ÚNICA: buscar (via react-query + Supabase) as áreas
 * VISÍVEIS ao usuário logado. Na F1 (organizar), a RLS já resolve a
 * visibilidade (aluno enxerga só `publicado = true`; admin enxerga todas —
 * ver `supabase/migrations/0009_areas.sql`), então o hook apenas lê a tabela
 * ordenada por `ordem` e devolve o resultado como veio.
 *
 * Degradação: a tabela `areas` pode não existir no schema remoto ainda
 * (migration 0009 não aplicada) → PostgREST devolve PGRST205 → degradamos
 * para vazio (mesmo padrão de `useGoals`/`useManagerClasses`), sem quebrar a
 * tela.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Area } from '../../types/content'

/** `data === null` + este code = tabela ausente (migration 0009 não aplicada). */
function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST205'
}

async function fetchAreas(): Promise<Area[]> {
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .order('ordem', { ascending: true })
  if (error) {
    if (isMissingTable(error)) {
      console.error(
        '[areas] tabela areas ausente (aplicar supabase/migrations/0009_areas.sql):',
        error.message,
      )
      return []
    }
    throw error
  }
  return (data ?? []) as Area[]
}

export interface UseAreasResult {
  areas: Area[]
  isLoading: boolean
  isError: boolean
  error: unknown
}

/** Hook público consumido pelas telas que listam Áreas. */
export function useAreas(): UseAreasResult {
  const query = useQuery({
    queryKey: ['areas'],
    queryFn: fetchAreas,
  })

  return {
    areas: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  }
}
