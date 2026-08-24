/**
 * quizRules — regras PURAS do quiz (Task 4.2). Sem banco, sem React.
 *
 * Estas funções ESPELHAM as regras autoritativas do servidor (RPC
 * `public.submit_quiz`, ver `supabase/migrations/0004_quiz.sql`) para uso
 * exclusivo de UX: desabilitar o botão "Enviar", mostrar contagem regressiva do
 * cooldown, e decidir se ainda cabe uma tentativa. A correção e as travas REAIS
 * são server-side; se cliente e servidor divergirem, o servidor vence (o cliente
 * só evita uma ida à rede fadada a falhar). Por isso os defaults batem com a RPC:
 * 80% aprova, máx 3 tentativas, cooldown 24h.
 */

/** Aprova quando `nota >= passPct`. Limite padrão 80 (igual à RPC). */
export function isPassing(nota: number, passPct = 80): boolean {
  return nota >= passPct
}

/** Motivo de bloqueio de nova tentativa (ou null quando liberado/aprovado). */
export type AttemptBlockedReason = 'cap' | 'cooldown' | null

/** Uma tentativa, na forma mínima que a regra precisa (linha de quiz_attempts). */
export interface AttemptLike {
  created_at: string
  aprovado: boolean
}

/** Resultado da avaliação do gate de tentativas para a UX. */
export interface AttemptGate {
  /** Tentativas já feitas (usadas). */
  attemptsUsed: number
  /** Tentativas ainda disponíveis (>= 0). */
  attemptsLeft: number
  /** true se ALGUMA tentativa foi aprovada (sucesso terminal). */
  passed: boolean
  /** true se o aluno pode iniciar uma nova tentativa agora. */
  canAttempt: boolean
  /** Por que está bloqueado ('cap' | 'cooldown'), ou null. */
  blockedReason: AttemptBlockedReason
  /** Instante em que a próxima tentativa libera (só no cooldown), ou null. */
  nextAllowedAt: Date | null
}

export interface AttemptGateConfig {
  maxAttempts?: number
  cooldownHours?: number
}

/**
 * Decide o estado do gate de tentativas, espelhando a RPC. Semântica:
 *  - `passed` = qualquer tentativa aprovada => sucesso terminal: NÃO oferece
 *    nova tentativa (canAttempt=false, blockedReason=null).
 *  - senão, `cap` quando attemptsUsed >= maxAttempts.
 *  - senão, `cooldown` quando a tentativa MAIS RECENTE foi há menos de
 *    cooldownHours (nextAllowedAt = última + cooldown).
 *  - senão, canAttempt=true.
 * Precedência: passed > cap > cooldown > liberado (igual à ordem de checagem da
 * RPC: aprovado encerra; depois teto; depois cooldown).
 */
export function evaluateAttemptGate(
  attempts: AttemptLike[],
  now: Date,
  cfg: AttemptGateConfig = {},
): AttemptGate {
  const maxAttempts = cfg.maxAttempts ?? 3
  const cooldownHours = cfg.cooldownHours ?? 24

  const attemptsUsed = attempts.length
  const attemptsLeft = Math.max(0, maxAttempts - attemptsUsed)
  const passed = attempts.some((a) => a.aprovado)

  // Aprovado encerra: nada de nova tentativa.
  if (passed) {
    return {
      attemptsUsed,
      attemptsLeft,
      passed: true,
      canAttempt: false,
      blockedReason: null,
      nextAllowedAt: null,
    }
  }

  // Teto de tentativas tem precedência sobre cooldown (igual à RPC).
  if (attemptsUsed >= maxAttempts) {
    return {
      attemptsUsed,
      attemptsLeft: 0,
      passed: false,
      canAttempt: false,
      blockedReason: 'cap',
      nextAllowedAt: null,
    }
  }

  // Cooldown: baseado na tentativa MAIS RECENTE (a entrada pode vir fora de
  // ordem, então achamos o max de created_at explicitamente).
  const lastMs = attempts.reduce((max, a) => {
    const t = new Date(a.created_at).getTime()
    return t > max ? t : max
  }, Number.NEGATIVE_INFINITY)

  if (attemptsUsed > 0 && Number.isFinite(lastMs)) {
    const cooldownMs = cooldownHours * 60 * 60 * 1000
    const elapsed = now.getTime() - lastMs
    if (elapsed < cooldownMs) {
      return {
        attemptsUsed,
        attemptsLeft,
        passed: false,
        canAttempt: false,
        blockedReason: 'cooldown',
        nextAllowedAt: new Date(lastMs + cooldownMs),
      }
    }
  }

  return {
    attemptsUsed,
    attemptsLeft,
    passed: false,
    canAttempt: true,
    blockedReason: null,
    nextAllowedAt: null,
  }
}
