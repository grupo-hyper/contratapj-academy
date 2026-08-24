/**
 * QuizPage — motor do teste do módulo (Task 4.2), estilo streaming dark.
 *
 * Composição pura: a busca/derivação vive em `useQuiz`; aqui montamos a tela
 * (TopNav + voltar, questões como radio groups acessíveis, envio) e os estados:
 * carregando, já aprovado, tentativas esgotadas (cap), cooldown (contagem/instante
 * em BRT), módulo sem questões, e o resultado pós-envio.
 *
 * A correção e as travas são SERVER-SIDE (RPC submit_quiz). O botão de enviar é
 * desabilitado por UX quando (a) nem todas as questões foram respondidas ou (b)
 * o gate local diz que não cabe tentativa — mas a decisão final é do servidor.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { TopNav } from '../../components/TopNav'
import type { QuizAnswers } from '../../types/content'
import { useQuizData, useSubmitQuiz } from './useQuiz'

/** Formata um instante UTC em data/hora de Brasília (America/Sao_Paulo). */
function formatBRT(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function QuizSkeleton() {
  return (
    <div className="mx-auto flex max-w-3xl animate-pulse flex-col gap-6 px-4 py-6">
      <div className="h-8 w-1/2 rounded bg-cpj-navy/40" />
      <div className="h-24 w-full rounded-2xl bg-cpj-navy/40" />
      <div className="h-24 w-full rounded-2xl bg-cpj-navy/40" />
      <div className="h-24 w-full rounded-2xl bg-cpj-navy/40" />
    </div>
  )
}

/** Painel simples reutilizado pelos estados terminais (aprovado/cap/vazio). */
function Panel({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-center">
      <div className="rounded-2xl border border-cpj-white/10 bg-cpj-navy/30 p-8">
        <p className="text-xl font-bold text-cpj-white">{title}</p>
        {children && (
          <div className="mt-3 text-sm text-cpj-white/70">{children}</div>
        )}
        <Link
          to="/"
          className="mt-6 inline-block rounded-lg bg-cpj-royal px-4 py-2 text-sm font-medium text-cpj-white transition hover:bg-cpj-royal/90"
        >
          Voltar para a Home
        </Link>
      </div>
    </div>
  )
}

export function QuizPage() {
  const { moduleId } = useParams<{ moduleId: string }>()
  const { profile, user, loading, signOut } = useAuth()

  // Mesma resolução de id da LessonPage/Home, para a invalidação casar com
  // ['quiz_attempts', profileId].
  const profileId = profile?.id ?? user?.id
  const userName = profile?.nome ?? user?.email ?? 'Aluno'
  const role = profile?.role

  const { questions, gate, isLoading, isError } = useQuizData(moduleId, profileId)
  const { submit, isSubmitting, result, rejection } = useSubmitQuiz(
    moduleId,
    profileId,
  )

  // Respostas selecionadas: questionId -> optionId.
  const [answers, setAnswers] = useState<QuizAnswers>({})

  const showLoading = loading || isLoading

  const allAnswered = useMemo(() => {
    if (!questions || questions.length === 0) return false
    return questions.every((q) => Boolean(answers[q.question.id]))
  }, [questions, answers])

  // Cooldown pode vir do gate (pré-envio) OU da rejeição da RPC (pós-envio).
  const cooldownAt =
    rejection?.code === 'cooldown'
      ? rejection.nextAllowedAt
      : gate?.blockedReason === 'cooldown'
        ? gate.nextAllowedAt
        : null

  const capReached =
    rejection?.code === 'cap' || (!rejection && gate?.blockedReason === 'cap')

  function renderBody() {
    if (isError) {
      return (
        <Panel title="Não foi possível carregar o teste.">
          Tente recarregar a página em instantes.
        </Panel>
      )
    }

    // Módulo sem questões (fetch vazio) OU a RPC recusou por P0005.
    if (
      rejection?.code === 'no_questions' ||
      (questions && questions.length === 0)
    ) {
      return (
        <Panel title="Este módulo ainda não tem teste.">
          Assim que as questões forem publicadas, o teste aparece aqui.
        </Panel>
      )
    }

    // Já aprovado (gate) — nunca mostra o formulário.
    if (gate?.passed && !result) {
      return (
        <Panel title="Módulo aprovado ✓">
          <p>Você já foi aprovado neste teste.</p>
          <Link
            to="/certificados"
            className="mt-4 inline-block rounded-lg bg-cpj-coral px-4 py-2 text-sm font-semibold text-cpj-white transition hover:bg-cpj-coral/90"
          >
            Ver meus certificados
          </Link>
        </Panel>
      )
    }

    // Resultado pós-envio.
    if (result) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-12 text-center">
          <div
            role="status"
            className="rounded-2xl border border-cpj-white/10 bg-cpj-navy/30 p-8"
          >
            <p className="text-3xl font-bold tabular-nums text-cpj-white">
              {result.nota}%
            </p>
            <p className="mt-1 text-sm text-cpj-white/70">
              {result.acertos} de {result.total} corretas
            </p>
            <p
              className={`mt-4 text-lg font-semibold ${
                result.aprovado ? 'text-green-400' : 'text-cpj-coral'
              }`}
            >
              {result.aprovado ? 'Aprovado ✓' : 'Reprovado'}
            </p>
            <p className="mt-2 text-sm text-cpj-white/70">
              {result.aprovado
                ? 'Seu certificado já está disponível.'
                : result.tentativas_restantes > 0
                  ? `Você ainda tem ${result.tentativas_restantes} tentativa(s).`
                  : 'Você atingiu o limite de tentativas.'}
            </p>
            {result.aprovado && (
              <Link
                to="/certificados"
                className="mt-4 inline-block rounded-lg bg-cpj-coral px-4 py-2 text-sm font-semibold text-cpj-white transition hover:bg-cpj-coral/90"
              >
                Ver meus certificados
              </Link>
            )}
            {!result.aprovado && result.proxima_liberacao && (
              <p className="mt-1 text-sm text-cpj-white/50">
                Próxima tentativa liberada em{' '}
                {formatBRT(new Date(result.proxima_liberacao))} (horário de
                Brasília).
              </p>
            )}
            <Link
              to="/"
              className="mt-6 inline-block rounded-lg bg-cpj-royal px-4 py-2 text-sm font-medium text-cpj-white transition hover:bg-cpj-royal/90"
            >
              Voltar para a Home
            </Link>
          </div>
        </div>
      )
    }

    // Tentativas esgotadas (cap).
    if (capReached) {
      return (
        <Panel title="Tentativas esgotadas">
          Você atingiu o limite de tentativas para este módulo.
        </Panel>
      )
    }

    // Cooldown ativo.
    if (cooldownAt) {
      return (
        <Panel title="Aguarde para tentar novamente">
          <p>
            Próxima tentativa liberada em{' '}
            <strong className="text-cpj-white">{formatBRT(cooldownAt)}</strong>{' '}
            (horário de Brasília).
          </p>
        </Panel>
      )
    }

    // Formulário do teste.
    if (!questions) return <QuizSkeleton />

    const canSubmit = allAnswered && Boolean(gate?.canAttempt) && !isSubmitting

    return (
      <form
        className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6"
        onSubmit={(e) => {
          e.preventDefault()
          if (canSubmit) submit(answers)
        }}
      >
        <h1 className="text-2xl font-bold text-cpj-white sm:text-3xl">
          Teste do módulo
        </h1>
        <p className="text-sm text-cpj-white/60">
          Responda todas as questões. Aprovação a partir de 80%.
          {typeof gate?.attemptsLeft === 'number' &&
            ` Tentativas restantes: ${gate.attemptsLeft}.`}
        </p>

        {questions.map((q, i) => (
          <fieldset
            key={q.question.id}
            className="rounded-2xl border border-cpj-white/10 bg-cpj-navy/20 p-5"
          >
            <legend className="mb-3 px-1 text-base font-semibold text-cpj-white">
              {i + 1}. {q.question.enunciado}
            </legend>
            <div className="flex flex-col gap-2">
              {q.options.map((opt) => (
                <label
                  key={opt.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-cpj-white/90 transition hover:bg-cpj-white/5"
                >
                  <input
                    type="radio"
                    name={q.question.id}
                    value={opt.id}
                    checked={answers[q.question.id] === opt.id}
                    onChange={() =>
                      setAnswers((prev) => ({
                        ...prev,
                        [q.question.id]: opt.id,
                      }))
                    }
                    className="h-4 w-4 accent-cpj-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-coral"
                  />
                  <span>{opt.texto}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <div className="flex flex-col gap-2">
          <button
            type="submit"
            disabled={!canSubmit}
            aria-busy={isSubmitting}
            className="w-full rounded-xl bg-cpj-coral px-4 py-3 text-sm font-semibold text-cpj-white transition hover:bg-cpj-coral/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-coral disabled:opacity-60 sm:w-auto"
          >
            {isSubmitting ? 'Enviando…' : 'Enviar teste'}
          </button>
          {!allAnswered && (
            <p className="text-sm text-cpj-white/50">
              Responda todas as questões para enviar.
            </p>
          )}
          {rejection && rejection.code === 'unknown' && (
            <p role="alert" className="text-sm text-cpj-coral">
              Não foi possível enviar. Tente novamente.
            </p>
          )}
        </div>
      </form>
    )
  }

  return (
    <main className="ocean-bg min-h-screen text-cpj-white">
      <TopNav userName={userName} role={role} onSignOut={signOut}>
        <Link
          to="/"
          className="text-cpj-white/70 transition hover:text-cpj-white"
        >
          ← Voltar
        </Link>
      </TopNav>

      {showLoading ? <QuizSkeleton /> : renderBody()}
    </main>
  )
}
