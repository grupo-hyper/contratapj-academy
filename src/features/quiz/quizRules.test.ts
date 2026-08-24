/**
 * Testes das regras PURAS do quiz (Task 4.2), escritas ANTES da implementação
 * (TDD). Estas funções ESPELHAM as regras autoritativas do servidor (a RPC
 * `submit_quiz` de 0004_quiz.sql) SOMENTE para UX: desabilitar o botão de
 * enviar, mostrar contagem regressiva, e decidir se ainda cabe uma tentativa.
 *
 * A correção real (nota) e a trava real (tentativas/cooldown) vivem no servidor.
 * Se o cliente e o servidor divergirem, o servidor vence (o cliente só evita uma
 * ida à rede fadada a falhar). Por isso os defaults aqui são os MESMOS da RPC:
 * 80% aprova, máx 3 tentativas, cooldown 24h.
 */
import { describe, expect, it } from 'vitest'
import { evaluateAttemptGate, isPassing } from './quizRules'

describe('isPassing', () => {
  it('aprova exatamente em 80 (limite inclusivo)', () => {
    expect(isPassing(80)).toBe(true)
  })

  it('reprova em 79 (abaixo do limite)', () => {
    expect(isPassing(79)).toBe(false)
  })

  it('aprova acima do limite (100)', () => {
    expect(isPassing(100)).toBe(true)
  })

  it('respeita um passPct customizado', () => {
    expect(isPassing(70, 70)).toBe(true)
    expect(isPassing(69, 70)).toBe(false)
  })
})

describe('evaluateAttemptGate', () => {
  const NOW = new Date('2026-08-24T12:00:00Z')

  it('sem tentativas: pode tentar, 3 restantes', () => {
    const gate = evaluateAttemptGate([], NOW)
    expect(gate).toMatchObject({
      attemptsUsed: 0,
      attemptsLeft: 3,
      passed: false,
      canAttempt: true,
      blockedReason: null,
      nextAllowedAt: null,
    })
  })

  it('passed dá curto-circuito: aprovado => não oferece nova tentativa', () => {
    // Mesmo que haja tentativas restantes e sem cooldown, aprovado encerra.
    const attempts = [
      { created_at: '2026-08-20T12:00:00Z', aprovado: true },
    ]
    const gate = evaluateAttemptGate(attempts, NOW)
    expect(gate.passed).toBe(true)
    expect(gate.canAttempt).toBe(false)
    expect(gate.blockedReason).toBeNull()
  })

  it('bloqueia a 4ª tentativa: 3 usadas => cap', () => {
    // 3 tentativas antigas (fora do cooldown) e nenhuma aprovada.
    const attempts = [
      { created_at: '2026-08-01T12:00:00Z', aprovado: false },
      { created_at: '2026-08-02T12:00:00Z', aprovado: false },
      { created_at: '2026-08-03T12:00:00Z', aprovado: false },
    ]
    const gate = evaluateAttemptGate(attempts, NOW)
    expect(gate.attemptsUsed).toBe(3)
    expect(gate.attemptsLeft).toBe(0)
    expect(gate.canAttempt).toBe(false)
    expect(gate.blockedReason).toBe('cap')
  })

  it('bloqueia dentro de 24h: cooldown com nextAllowedAt correto', () => {
    // Última tentativa há 2h => ainda em cooldown. Próxima = última + 24h.
    const last = '2026-08-24T10:00:00Z'
    const attempts = [{ created_at: last, aprovado: false }]
    const gate = evaluateAttemptGate(attempts, NOW)
    expect(gate.canAttempt).toBe(false)
    expect(gate.blockedReason).toBe('cooldown')
    expect(gate.nextAllowedAt?.toISOString()).toBe('2026-08-25T10:00:00.000Z')
  })

  it('libera após 24h: fora do cooldown e abaixo do cap => canAttempt', () => {
    // Última tentativa há 25h.
    const attempts = [{ created_at: '2026-08-23T11:00:00Z', aprovado: false }]
    const gate = evaluateAttemptGate(attempts, NOW)
    expect(gate.canAttempt).toBe(true)
    expect(gate.blockedReason).toBeNull()
    expect(gate.nextAllowedAt).toBeNull()
    expect(gate.attemptsUsed).toBe(1)
    expect(gate.attemptsLeft).toBe(2)
  })

  it('precedência cap > cooldown: 3 usadas E dentro de 24h => cap (não cooldown)', () => {
    const attempts = [
      { created_at: '2026-08-24T09:00:00Z', aprovado: false },
      { created_at: '2026-08-24T10:00:00Z', aprovado: false },
      { created_at: '2026-08-24T11:00:00Z', aprovado: false },
    ]
    const gate = evaluateAttemptGate(attempts, NOW)
    expect(gate.blockedReason).toBe('cap')
  })

  it('usa a tentativa MAIS RECENTE para o cooldown (ordem de entrada irrelevante)', () => {
    // Entrada fora de ordem: a mais recente é a de 11h (há 1h) => cooldown.
    const attempts = [
      { created_at: '2026-08-24T11:00:00Z', aprovado: false },
      { created_at: '2026-08-20T11:00:00Z', aprovado: false },
    ]
    const gate = evaluateAttemptGate(attempts, NOW)
    expect(gate.blockedReason).toBe('cooldown')
    expect(gate.nextAllowedAt?.toISOString()).toBe('2026-08-25T11:00:00.000Z')
  })

  it('respeita cfg customizado (maxAttempts/cooldownHours)', () => {
    const attempts = [
      { created_at: '2026-08-24T11:00:00Z', aprovado: false },
    ]
    // cooldown de 1h => última há 1h está NO limite (não < 1h) => libera.
    const gate = evaluateAttemptGate(attempts, NOW, {
      maxAttempts: 5,
      cooldownHours: 1,
    })
    expect(gate.canAttempt).toBe(true)
    expect(gate.attemptsLeft).toBe(4)
  })
})
