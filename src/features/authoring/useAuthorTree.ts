/**
 * useAuthorTree — camada de leitura da árvore do CMS do autor.
 *
 * Responsabilidade ÚNICA: buscar TODOS os módulos e TODAS as aulas (SEM filtro
 * `publicado` — a RLS do papel `autor` já libera rascunhos, ver
 * `0002_content.sql`) e agrupar as aulas por `module_id`, prontas para a árvore.
 *
 * Chaves de query (`['author_tree', ...]`) são separadas das do aluno
 * (`['modules']`/`['lessons']`) porque o conjunto é diferente (inclui rascunhos);
 * o `useSaveLesson` invalida ambas para manter aluno e autor coerentes.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Lesson, Module } from '../../types/content'

async function fetchAllModules(): Promise<Module[]> {
  const { data, error } = await supabase
    .from('modules')
    .select('*')
    .order('ordem', { ascending: true })
  if (error) throw error
  return (data ?? []) as Module[]
}

async function fetchAllLessons(): Promise<Lesson[]> {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .order('module_id', { ascending: true })
    .order('ordem', { ascending: true })
  if (error) throw error
  return (data ?? []) as Lesson[]
}

/** Agrupa aulas por módulo preservando a ordem vinda do banco. */
function groupByModule(lessons: Lesson[]): Record<string, Lesson[]> {
  const map: Record<string, Lesson[]> = {}
  for (const lesson of lessons) {
    ;(map[lesson.module_id] ??= []).push(lesson)
  }
  return map
}

export interface UseAuthorTreeResult {
  modules: Module[]
  lessonsByModule: Record<string, Lesson[]>
  isLoading: boolean
  isError: boolean
  error: unknown
}

export function useAuthorTree(): UseAuthorTreeResult {
  const modulesQuery = useQuery({
    queryKey: ['author_tree', 'modules'],
    queryFn: fetchAllModules,
  })
  const lessonsQuery = useQuery({
    queryKey: ['author_tree', 'lessons'],
    queryFn: fetchAllLessons,
  })

  return {
    modules: modulesQuery.data ?? [],
    lessonsByModule: groupByModule(lessonsQuery.data ?? []),
    isLoading: modulesQuery.isLoading || lessonsQuery.isLoading,
    isError: modulesQuery.isError || lessonsQuery.isError,
    error: modulesQuery.error ?? lessonsQuery.error,
  }
}
