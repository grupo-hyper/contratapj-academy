/**
 * Testes da regra de trilha sequencial travada (sequential-lock).
 * Alvo: a função PURA `computeUnlockState` — sem react-query, sem Supabase,
 * sem fetch. Roda só sobre dados TS puros (nenhum acesso a banco).
 *
 * Regra de negócio (Fase 3):
 *  - O módulo de menor `ordem` (1) está SEMPRE liberado.
 *  - Um módulo está `done` quando TODAS as suas aulas publicadas estão
 *    concluídas (e, quando a Fase 4 plugar, o quiz aprovado — ver seam abaixo).
 *  - O módulo N+1 libera se e somente se o módulo N está `done`.
 *  - O primeiro módulo liberado-mas-não-concluído é o `current`; tudo depois
 *    do primeiro não-`done` fica `locked`.
 */
import { describe, expect, it } from 'vitest'
import { computeUnlockState } from './useUnlock'
import type { Lesson, Module } from '../../types/content'

// ---- Helpers de fixture (mínimos, só os campos que a regra usa) ------------
function mod(ordem: number, publicado = true): Module {
  return {
    id: `m${ordem}`,
    area_id: 'a1',
    ordem,
    titulo: `Módulo ${ordem}`,
    descricao: null,
    capa_url: null,
    publicado,
    created_at: '2026-01-01T00:00:00Z',
  }
}

function lesson(id: string, moduleId: string, ordem: number, publicado = true): Lesson {
  return {
    id,
    module_id: moduleId,
    ordem,
    titulo: `Aula ${ordem}`,
    texto_md: null,
    youtube_id: null,
    duracao_seg: null,
    publicado,
    created_at: '2026-01-01T00:00:00Z',
  }
}

describe('computeUnlockState — trilha sequencial travada', () => {
  it('módulo 1 está liberado e é o current quando nada foi concluído', () => {
    const modules = [mod(1), mod(2)]
    const lessonsByModule = {
      m1: [lesson('l1a', 'm1', 1), lesson('l1b', 'm1', 2)],
      m2: [lesson('l2a', 'm2', 1)],
    }
    const state = computeUnlockState({
      modules,
      lessonsByModule,
      concludedLessonIds: new Set<string>(),
    })

    expect(state.m1).toMatchObject({ state: 'current', unlocked: true, completed: false })
    expect(state.m2).toMatchObject({ state: 'locked', unlocked: false, completed: false })
  })

  it('módulo 2 permanece locked até TODAS as aulas publicadas do módulo 1 estarem concluídas', () => {
    const modules = [mod(1), mod(2)]
    const lessonsByModule = {
      m1: [lesson('l1a', 'm1', 1), lesson('l1b', 'm1', 2)],
      m2: [lesson('l2a', 'm2', 1)],
    }
    // Só uma das duas aulas do módulo 1 concluída → módulo 1 ainda NÃO done.
    const state = computeUnlockState({
      modules,
      lessonsByModule,
      concludedLessonIds: new Set(['l1a']),
    })

    expect(state.m1).toMatchObject({ state: 'current', completed: false })
    expect(state.m2).toMatchObject({ state: 'locked', unlocked: false })
  })

  it('concluir todas as aulas do módulo 1 marca-o done e torna o módulo 2 current', () => {
    const modules = [mod(1), mod(2)]
    const lessonsByModule = {
      m1: [lesson('l1a', 'm1', 1), lesson('l1b', 'm1', 2)],
      m2: [lesson('l2a', 'm2', 1)],
    }
    const state = computeUnlockState({
      modules,
      lessonsByModule,
      concludedLessonIds: new Set(['l1a', 'l1b']),
    })

    expect(state.m1).toMatchObject({ state: 'done', unlocked: true, completed: true })
    expect(state.m2).toMatchObject({ state: 'current', unlocked: true, completed: false })
  })

  it('aulas NÃO publicadas não contam para a conclusão do módulo', () => {
    const modules = [mod(1), mod(2)]
    const lessonsByModule = {
      // l1b é rascunho (não publicada): concluir só l1a já basta para done.
      m1: [lesson('l1a', 'm1', 1), lesson('l1b', 'm1', 2, false)],
      m2: [lesson('l2a', 'm2', 1)],
    }
    const state = computeUnlockState({
      modules,
      lessonsByModule,
      concludedLessonIds: new Set(['l1a']),
    })

    expect(state.m1).toMatchObject({ state: 'done', completed: true })
    expect(state.m2).toMatchObject({ state: 'current', unlocked: true })
  })

  it('módulo sem aulas publicadas é considerado done (não trava a trilha)', () => {
    const modules = [mod(1), mod(2)]
    const lessonsByModule = {
      m1: [] as Lesson[],
      m2: [lesson('l2a', 'm2', 1)],
    }
    const state = computeUnlockState({
      modules,
      lessonsByModule,
      concludedLessonIds: new Set<string>(),
    })

    // Sem aulas publicadas -> "todas concluídas" é vacuamente verdadeiro.
    expect(state.m1.completed).toBe(true)
    expect(state.m2).toMatchObject({ state: 'current', unlocked: true })
  })

  it('só o módulo 1 (menor ordem) libera por padrão, mesmo com módulos fora de ordem na entrada', () => {
    // Entrada desordenada: a função deve ordenar por `ordem`.
    const modules = [mod(3), mod(1), mod(2)]
    const lessonsByModule = {
      m1: [lesson('l1a', 'm1', 1)],
      m2: [lesson('l2a', 'm2', 1)],
      m3: [lesson('l3a', 'm3', 1)],
    }
    const state = computeUnlockState({
      modules,
      lessonsByModule,
      concludedLessonIds: new Set<string>(),
    })

    expect(state.m1).toMatchObject({ state: 'current', unlocked: true })
    expect(state.m2.state).toBe('locked')
    expect(state.m3.state).toBe('locked')
  })

  it('curso vazio (sem módulos) retorna mapa vazio', () => {
    const state = computeUnlockState({
      modules: [],
      lessonsByModule: {},
      concludedLessonIds: new Set<string>(),
    })
    expect(state).toEqual({})
  })

  it('ordenação é determinística quando dois módulos têm o mesmo `ordem` (desempate por id)', () => {
    // Ambos com ordem=1; entrada em ordem "errada" (mb antes de ma).
    const ma = { ...mod(1), id: 'ma' }
    const mb = { ...mod(1), id: 'mb' }
    const lessonsByModule = {
      ma: [lesson('la', 'ma', 1)],
      mb: [lesson('lb', 'mb', 1)],
    }
    const state = computeUnlockState({
      modules: [mb, ma], // desordenado de propósito
      lessonsByModule,
      concludedLessonIds: new Set<string>(),
    })

    // Desempate por id (localeCompare): 'ma' < 'mb', então 'ma' é o 1º → current;
    // 'mb' fica locked. Resultado estável e previsível, independe da inserção.
    expect(state.ma).toMatchObject({ state: 'current', unlocked: true })
    expect(state.mb).toMatchObject({ state: 'locked', unlocked: false })
  })

  // ---- SEAM da Fase 4: gate de aprovação no quiz --------------------------
  // A tabela de tentativas de quiz NÃO existe ainda (chega na Fase 4). Hoje o
  // gate concreto é "todas as aulas publicadas concluídas". O parâmetro
  // opcional `quizPassedByModule` já existe como PONTO DE EXTENSÃO: quando a
  // Fase 4 passar esse predicado/mapa, um módulo com aulas todas concluídas mas
  // quiz reprovado NÃO fica done — provando que o gate encaixa sem reescrita.
  it('(seam Fase 4) com quizPassedByModule=false, módulo com aulas concluídas NÃO fica done', () => {
    const modules = [mod(1), mod(2)]
    const lessonsByModule = {
      m1: [lesson('l1a', 'm1', 1)],
      m2: [lesson('l2a', 'm2', 1)],
    }
    const state = computeUnlockState({
      modules,
      lessonsByModule,
      concludedLessonIds: new Set(['l1a']),
      // Quiz do módulo 1 ainda não aprovado.
      quizPassedByModule: { m1: false },
    })

    // Aulas todas concluídas, mas o gate de quiz reprova → não done, segue current.
    expect(state.m1).toMatchObject({ state: 'current', completed: false })
    expect(state.m2.state).toBe('locked')
  })

  it('(seam Fase 4) ausência de entrada em quizPassedByModule NÃO bloqueia (default permissivo)', () => {
    const modules = [mod(1), mod(2)]
    const lessonsByModule = {
      m1: [lesson('l1a', 'm1', 1)],
      m2: [lesson('l2a', 'm2', 1)],
    }
    // Mapa presente mas sem entrada para m1 → não deve travar (default = passa).
    const state = computeUnlockState({
      modules,
      lessonsByModule,
      concludedLessonIds: new Set(['l1a']),
      quizPassedByModule: {},
    })

    expect(state.m1).toMatchObject({ state: 'done', completed: true })
    expect(state.m2).toMatchObject({ state: 'current', unlocked: true })
  })
})
