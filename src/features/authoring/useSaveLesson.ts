/**
 * useSaveLesson — mutation que persiste a edição de UMA aula (UPDATE em `lessons`
 * pelo id). Só o autor tem policy de UPDATE (RLS `lessons_write_autor`).
 *
 * Invalidação no sucesso:
 *  - `['author_tree', 'lessons']` → a árvore do CMS reflete título/publicado;
 *  - `['lessons']` e `['lesson', id]` → Home e player do ALUNO refletem a
 *    publicação/edição (mesmas chaves de `useHomeData.ts` e `useLesson.ts`).
 *
 * NÃO faz otimismo nem toca no cache diretamente: invalidar e refazer é simples
 * e suficiente para o volume do CMS.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { LessonUpdate } from './lessonDraft'

export interface SaveLessonVars {
  id: string
  patch: LessonUpdate
}

async function updateLesson({ id, patch }: SaveLessonVars): Promise<void> {
  const { error } = await supabase.from('lessons').update(patch).eq('id', id)
  if (error) throw error
}

export interface UseSaveLessonResult {
  save: (vars: SaveLessonVars) => void
  isSaving: boolean
  isError: boolean
  isSuccess: boolean
  error: unknown
  /** Zera o estado de erro/sucesso (ex.: ao trocar de aula). */
  reset: () => void
}

export function useSaveLesson(): UseSaveLessonResult {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: updateLesson,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['author_tree', 'lessons'] })
      void queryClient.invalidateQueries({ queryKey: ['lessons'] })
      void queryClient.invalidateQueries({ queryKey: ['lesson', vars.id] })
    },
  })

  return {
    save: (vars) => mutation.mutate(vars),
    isSaving: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    reset: () => mutation.reset(),
  }
}
