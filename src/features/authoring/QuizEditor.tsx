/**
 * QuizEditor — painel DIREITO do CMS quando o "Quiz do módulo" está selecionado
 * (F3). Lista as perguntas do módulo e, sob cada uma, suas alternativas.
 *
 * Persistência via `useModuleQuiz` (hook próprio da F3): criar/editar/excluir
 * pergunta e alternativa; marcar UMA alternativa correta por pergunta (radio).
 * Edições de texto salvam no `onBlur` (perde o foco → grava) só quando o valor
 * mudou — evita gravação a cada tecla. Exclusões pedem `window.confirm`.
 *
 * Validação LEVE (não bloqueia): avisa quando uma pergunta não tem alternativa
 * correta marcada ou tem menos de 2 alternativas. É só um lembrete pro autor.
 *
 * Estilo dark coerente com ModuleEditor/LessonEditor (cores `cpj`).
 */
import { useModuleQuiz, type EditableQuestion } from './useModuleQuiz'

/** Avisos de validação leve de uma pergunta (não impede salvar). */
function warningsFor(q: EditableQuestion): string[] {
  const avisos: string[] = []
  if (q.options.length < 2) avisos.push('menos de 2 alternativas')
  if (!q.options.some((o) => o.correta))
    avisos.push('sem alternativa correta')
  return avisos
}

interface QuizEditorProps {
  moduleId: string
  /** Título do módulo (cabeçalho). Opcional. */
  moduleTitle?: string
}

export function QuizEditor({ moduleId, moduleTitle }: QuizEditorProps) {
  const {
    questions,
    isLoading,
    isError,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    createOption,
    updateOptionText,
    deleteOption,
    setCorrectOption,
    isMutationError,
  } = useModuleQuiz(moduleId)

  const onDeleteQuestion = (q: EditableQuestion) => {
    if (
      window.confirm(
        `Excluir esta pergunta e todas as suas alternativas?\n\n"${q.enunciado}"`,
      )
    ) {
      deleteQuestion(q.id)
    }
  }

  const onDeleteOption = (optionId: string, texto: string) => {
    if (window.confirm(`Excluir a alternativa "${texto}"?`)) {
      deleteOption(optionId)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-cpj-white">
          Quiz do módulo
          {moduleTitle ? (
            <span className="ml-2 font-normal text-cpj-white/50">
              — {moduleTitle}
            </span>
          ) : null}
        </h2>
        <button
          type="button"
          onClick={() => createQuestion('Nova pergunta')}
          className="rounded-xl bg-cpj-coral px-4 py-2 text-sm font-semibold text-cpj-white transition hover:bg-cpj-coral/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-coral"
        >
          + Nova pergunta
        </button>
      </div>

      {(isError || isMutationError) && (
        <p role="alert" className="text-sm text-cpj-coral">
          Não foi possível carregar/salvar o quiz. Verifique sua
          conexão/permissão e tente de novo.
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-cpj-white/50">Carregando…</p>
      ) : questions.length === 0 ? (
        <p className="text-sm text-cpj-white/50">
          Este módulo ainda não tem perguntas. Crie a primeira acima.
        </p>
      ) : (
        <ol className="flex flex-col gap-6">
          {questions.map((q, idx) => {
            const avisos = warningsFor(q)
            return (
              <li
                key={q.id}
                className="rounded-2xl border border-cpj-white/10 bg-cpj-navy/20 p-4"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-2 shrink-0 tabular-nums text-cpj-white/40">
                    {idx + 1}.
                  </span>
                  <label className="flex-1">
                    <span className="sr-only">
                      Enunciado da pergunta {idx + 1}
                    </span>
                    <input
                      type="text"
                      aria-label={`Enunciado da pergunta ${idx + 1}`}
                      defaultValue={q.enunciado}
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        if (v && v !== q.enunciado) updateQuestion(q.id, v)
                      }}
                      className="w-full rounded-xl border border-cpj-white/15 bg-cpj-navy/20 px-3 py-2 text-cpj-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => onDeleteQuestion(q)}
                    aria-label={`Excluir pergunta ${idx + 1}`}
                    className="mt-1 rounded px-2 py-1 text-xs text-cpj-white/50 transition hover:text-cpj-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-coral"
                  >
                    Excluir pergunta
                  </button>
                </div>

                {avisos.length > 0 && (
                  <p className="ml-6 mt-2 text-xs text-cpj-white/40">
                    ⚠ {avisos.join(' · ')}
                  </p>
                )}

                <ul className="ml-6 mt-3 flex flex-col gap-2">
                  {q.options.map((o) => (
                    <li key={o.id} className="flex items-center gap-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correta-${q.id}`}
                          checked={o.correta}
                          onChange={() => setCorrectOption(q.id, o.id)}
                          aria-label={`Marcar "${o.texto}" como correta`}
                          className="h-4 w-4 accent-cpj-coral"
                        />
                        <span className="sr-only">Alternativa correta</span>
                      </label>
                      <input
                        type="text"
                        aria-label={`Texto da alternativa "${o.texto}"`}
                        defaultValue={o.texto}
                        onBlur={(e) => {
                          const v = e.target.value.trim()
                          if (v && v !== o.texto) updateOptionText(o.id, v)
                        }}
                        className="flex-1 rounded-lg border border-cpj-white/15 bg-cpj-navy/20 px-3 py-1.5 text-sm text-cpj-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal"
                      />
                      {o.correta && (
                        <span className="shrink-0 text-xs font-semibold text-cpj-coral">
                          correta ✓
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onDeleteOption(o.id, o.texto)}
                        aria-label={`Excluir alternativa "${o.texto}"`}
                        className="rounded px-2 py-1 text-xs text-cpj-white/50 transition hover:text-cpj-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-coral"
                      >
                        Excluir
                      </button>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => createOption(q.id, 'Nova alternativa')}
                  className="ml-6 mt-2 rounded-lg px-3 py-1 text-xs font-semibold text-cpj-white/60 transition hover:bg-cpj-white/5 hover:text-cpj-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal"
                >
                  + Nova alternativa
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
