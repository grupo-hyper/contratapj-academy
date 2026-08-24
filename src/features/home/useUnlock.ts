/**
 * useUnlock — regra de TRILHA SEQUENCIAL TRAVADA (sequential-lock) da Home.
 *
 * A Home (Task 3.2) busca módulos + aulas + progresso e PASSA os dados aqui;
 * este arquivo NÃO faz fetch nem toca no Supabase. A lógica de liberação vive
 * numa função PURA e determinística (`computeUnlockState`) para ser 100%
 * testável sem banco. Um hook fino (`useUnlock`) é oferecido por conveniência
 * para quem já tem os dados em mãos.
 *
 * REGRA (Fase 3):
 *  - O módulo de menor `ordem` está SEMPRE liberado.
 *  - Um módulo está `done` quando TODAS as suas aulas publicadas estão
 *    concluídas (aula publicada não concluída => não done). Módulo sem aulas
 *    publicadas conta como done (vacuamente verdadeiro; não trava a trilha).
 *  - O módulo N+1 libera se e somente se o módulo N está `done`.
 *  - O primeiro módulo liberado-mas-não-`done` é o `current`; tudo depois do
 *    primeiro módulo não-`done` fica `locked`.
 *
 * DEFERRAL / SEAM DA FASE 4 (quiz):
 *  A regra completa do plano é "módulo N concluído = todas as aulas feitas E
 *  quiz aprovado". A feature de quiz (tentativas do aluno) NÃO existe nesta
 *  fase — chega na Fase 4. Portanto o gate CONCRETO de hoje é apenas "todas as
 *  aulas publicadas concluídas". Para que a Fase 4 encaixe o gate de quiz SEM
 *  reescrever esta função, expomos o parâmetro OPCIONAL `quizPassedByModule`:
 *  um mapa moduleId -> boolean. Semântica intencionalmente PERMISSIVA por
 *  padrão: se o mapa não for informado, ou não tiver entrada para o módulo, o
 *  quiz é tratado como "não bloqueia" (passa). A Fase 4 só precisará popular
 *  esse mapa a partir da sua fonte de aprovação; nenhuma referência a tabela de
 *  quiz é feita aqui (ela ainda não existe).
 */
import type { Lesson, Module } from '../../types/content'

/** Estado de liberação de um módulo, alinhado a `TileState` do componente Tile. */
export type ModuleUnlockState = 'done' | 'current' | 'locked'

/** Resultado por módulo. `state` espelha os três estados visuais do Tile. */
export interface ModuleUnlock {
  moduleId: string
  ordem: number
  state: ModuleUnlockState
  /** true quando o módulo pode ser aberto (done ou current). */
  unlocked: boolean
  /** true quando o módulo satisfaz o gate de conclusão (aulas + seam de quiz). */
  completed: boolean
}

/** Mapa moduleId -> estado de liberação. */
export type UnlockStateMap = Record<string, ModuleUnlock>

export interface ComputeUnlockInput {
  /** Módulos (qualquer ordem na entrada; a função ordena por `ordem`). */
  modules: Module[]
  /** Aulas agrupadas por module_id. Só as PUBLICADAS contam para a conclusão. */
  lessonsByModule: Record<string, Lesson[]>
  /** Conjunto de ids de aulas com `concluida = true` para o usuário atual. */
  concludedLessonIds: ReadonlySet<string>
  /**
   * SEAM da Fase 4: mapa moduleId -> quiz aprovado?. Opcional e permissivo:
   * ausência do mapa ou da chave => não bloqueia (ver doc no topo do arquivo).
   */
  quizPassedByModule?: Record<string, boolean>
}

/**
 * Decide se o gate de conclusão de UM módulo foi satisfeito.
 * Gate = (todas as aulas publicadas concluídas) E (quiz não reprovado).
 */
function isModuleCompleted(
  module: Module,
  lessonsByModule: Record<string, Lesson[]>,
  concludedLessonIds: ReadonlySet<string>,
  quizPassedByModule?: Record<string, boolean>,
): boolean {
  const publishedLessons = (lessonsByModule[module.id] ?? []).filter((l) => l.publicado)

  // Todas as aulas publicadas precisam estar concluídas. Sem aulas publicadas =>
  // vacuamente verdadeiro (Array.every sobre lista vazia é true).
  const allLessonsDone = publishedLessons.every((l) => concludedLessonIds.has(l.id))
  if (!allLessonsDone) return false

  // Seam Fase 4: quiz só bloqueia se houver uma entrada EXPLÍCITA `false`.
  // Ausência (undefined) = permissivo = passa.
  if (quizPassedByModule && quizPassedByModule[module.id] === false) {
    return false
  }

  return true
}

/**
 * Calcula o estado de liberação de todos os módulos. Função PURA e
 * determinística: mesma entrada -> mesma saída, sem efeitos colaterais.
 */
export function computeUnlockState(input: ComputeUnlockInput): UnlockStateMap {
  const { modules, lessonsByModule, concludedLessonIds, quizPassedByModule } = input

  // Ordena por `ordem` (não muta a entrada). O de menor ordem é sempre o 1º.
  const ordered = [...modules].sort((a, b) => a.ordem - b.ordem)

  const result: UnlockStateMap = {}
  // O módulo corrente está liberado enquanto o anterior estiver `done`. Começa
  // true porque o primeiro módulo é sempre liberado.
  let prevDone = true

  for (const module of ordered) {
    const unlocked: boolean = prevDone
    const completed: boolean =
      unlocked &&
      isModuleCompleted(module, lessonsByModule, concludedLessonIds, quizPassedByModule)

    let state: ModuleUnlockState
    if (!unlocked) {
      state = 'locked'
    } else if (completed) {
      state = 'done'
    } else {
      state = 'current'
    }

    result[module.id] = {
      moduleId: module.id,
      ordem: module.ordem,
      state,
      unlocked,
      completed,
    }

    // O próximo só libera se ESTE módulo estiver done.
    prevDone = completed
  }

  return result
}

/**
 * Hook fino de conveniência: apenas encapsula `computeUnlockState`. NÃO faz
 * fetch — a Home passa os dados já carregados. Mantido simples de propósito
 * para preservar a testabilidade da regra pura acima.
 */
export function useUnlock(input: ComputeUnlockInput): UnlockStateMap {
  return computeUnlockState(input)
}
