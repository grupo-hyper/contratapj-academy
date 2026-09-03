/**
 * AuthorTree — painel ESQUERDO do CMS: a árvore Módulos ▸ Aulas (F2).
 *
 * Navegação + gestão: selecionar um MÓDULO (abre ModuleEditor) ou uma AULA (abre
 * LessonEditor); criar módulo/aula; excluir módulo/aula (com confirm no pai, via
 * callback); reordenar com ↑↓ (troca com o vizinho — ↑ some no primeiro, ↓ no
 * último). Marca rascunhos com um selo e destaca o item selecionado
 * (`aria-current`).
 *
 * O componente é "burro": chama callbacks; toda persistência/confirmação mora no
 * pai (AuthorPage + useAuthorMutations).
 */
import type { Lesson, Module } from '../../types/content'

interface AuthorTreeProps {
  modules: Module[]
  lessonsByModule: Record<string, Lesson[]>
  selectedLessonId: string | null
  onSelectLesson: (lessonId: string) => void
  /** Módulo selecionado (para o ModuleEditor). */
  selectedModuleId?: string | null
  onSelectModule?: (moduleId: string) => void
  onCreateModule?: () => void
  onCreateLesson?: (moduleId: string) => void
  onDeleteModule?: (module: Module) => void
  onDeleteLesson?: (lesson: Lesson) => void
  /** Troca o módulo com o vizinho (dir = -1 sobe, +1 desce). */
  onReorderModule?: (module: Module, dir: -1 | 1) => void
  /** Troca a aula com a vizinha dentro do módulo. */
  onReorderLesson?: (lesson: Lesson, dir: -1 | 1) => void
  /** Seleciona o quiz do módulo (abre o QuizEditor). */
  onSelectQuiz?: (moduleId: string) => void
  /** Módulo cujo quiz está selecionado (para destacar o item). */
  selectedQuizModuleId?: string | null
}

function DraftBadge() {
  return (
    <span className="ml-2 rounded-full bg-cpj-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cpj-white/60">
      rascunho
    </span>
  )
}

/** Botõezinhos ↑↓ de reordenação (desabilitados nas pontas). */
function ReorderButtons({
  onUp,
  onDown,
  disableUp,
  disableDown,
  label,
}: {
  onUp: () => void
  onDown: () => void
  disableUp: boolean
  disableDown: boolean
  label: string
}) {
  const base =
    'rounded px-1 text-xs text-cpj-white/50 transition hover:text-cpj-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal disabled:cursor-not-allowed disabled:opacity-30'
  return (
    <span className="flex shrink-0 items-center">
      <button
        type="button"
        onClick={onUp}
        disabled={disableUp}
        aria-label={`Mover ${label} para cima`}
        className={base}
      >
        ↑
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={disableDown}
        aria-label={`Mover ${label} para baixo`}
        className={base}
      >
        ↓
      </button>
    </span>
  )
}

export function AuthorTree({
  modules,
  lessonsByModule,
  selectedLessonId,
  onSelectLesson,
  selectedModuleId = null,
  onSelectModule,
  onCreateModule,
  onCreateLesson,
  onDeleteModule,
  onDeleteLesson,
  onReorderModule,
  onReorderLesson,
  onSelectQuiz,
  selectedQuizModuleId = null,
}: AuthorTreeProps) {
  return (
    <nav aria-label="Módulos e aulas" className="flex flex-col gap-4">
      {modules.map((module, mIdx) => {
        const lessons = lessonsByModule[module.id] ?? []
        const isModuleSelected = module.id === selectedModuleId
        return (
          <div key={module.id}>
            <div className="flex items-center gap-1 px-2">
              <button
                type="button"
                onClick={() => onSelectModule?.(module.id)}
                aria-current={isModuleSelected ? 'true' : undefined}
                className={`flex min-w-0 flex-1 items-center rounded-lg px-2 py-1 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal ${
                  isModuleSelected
                    ? 'bg-cpj-royal/25 text-cpj-white'
                    : 'text-cpj-white/80 hover:bg-cpj-white/5'
                }`}
              >
                <span className="tabular-nums text-cpj-white/40">
                  {module.ordem}.
                </span>
                <span className="ml-2 truncate">{module.titulo}</span>
                {!module.publicado && <DraftBadge />}
              </button>
              {onReorderModule && (
                <ReorderButtons
                  label={`módulo ${module.titulo}`}
                  onUp={() => onReorderModule(module, -1)}
                  onDown={() => onReorderModule(module, 1)}
                  disableUp={mIdx === 0}
                  disableDown={mIdx === modules.length - 1}
                />
              )}
              {onDeleteModule && (
                <button
                  type="button"
                  onClick={() => onDeleteModule(module)}
                  aria-label={`Excluir módulo ${module.titulo}`}
                  className="shrink-0 rounded px-1 text-xs text-cpj-white/50 transition hover:text-cpj-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-coral"
                >
                  Excluir
                </button>
              )}
            </div>
            <ul className="mt-1 flex flex-col">
              {lessons.length === 0 && (
                <li className="px-4 py-1 text-xs text-cpj-white/40">
                  (sem aulas)
                </li>
              )}
              {lessons.map((lesson, lIdx) => {
                const isSelected = lesson.id === selectedLessonId
                return (
                  <li key={lesson.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onSelectLesson(lesson.id)}
                      aria-current={isSelected ? 'true' : undefined}
                      className={`flex min-w-0 flex-1 items-center rounded-lg px-4 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal ${
                        isSelected
                          ? 'bg-cpj-royal/25 text-cpj-white'
                          : 'text-cpj-white/70 hover:bg-cpj-white/5'
                      }`}
                    >
                      <span className="tabular-nums text-cpj-white/40">
                        {lesson.ordem}.
                      </span>
                      <span className="ml-2 truncate">{lesson.titulo}</span>
                      {!lesson.publicado && <DraftBadge />}
                    </button>
                    {onReorderLesson && (
                      <ReorderButtons
                        label={`aula ${lesson.titulo}`}
                        onUp={() => onReorderLesson(lesson, -1)}
                        onDown={() => onReorderLesson(lesson, 1)}
                        disableUp={lIdx === 0}
                        disableDown={lIdx === lessons.length - 1}
                      />
                    )}
                    {onDeleteLesson && (
                      <button
                        type="button"
                        onClick={() => onDeleteLesson(lesson)}
                        aria-label={`Excluir aula ${lesson.titulo}`}
                        className="shrink-0 rounded px-1 text-xs text-cpj-white/50 transition hover:text-cpj-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-coral"
                      >
                        Excluir
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
            {onCreateLesson && (
              <button
                type="button"
                onClick={() => onCreateLesson(module.id)}
                className="ml-4 mt-1 rounded-lg px-3 py-1 text-left text-xs font-semibold text-cpj-white/60 transition hover:bg-cpj-white/5 hover:text-cpj-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal"
              >
                + nova aula
              </button>
            )}
            {onSelectQuiz && (
              <button
                type="button"
                onClick={() => onSelectQuiz(module.id)}
                aria-current={
                  module.id === selectedQuizModuleId ? 'true' : undefined
                }
                className={`ml-4 mt-1 flex items-center rounded-lg px-3 py-1 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal ${
                  module.id === selectedQuizModuleId
                    ? 'bg-cpj-royal/25 text-cpj-white'
                    : 'text-cpj-white/60 hover:bg-cpj-white/5 hover:text-cpj-white'
                }`}
              >
                <span aria-hidden="true" className="mr-1">
                  ?
                </span>
                Quiz do módulo
              </button>
            )}
          </div>
        )
      })}
      {onCreateModule && (
        <button
          type="button"
          onClick={onCreateModule}
          className="mt-2 rounded-lg border border-cpj-white/15 px-3 py-2 text-sm font-semibold text-cpj-white/80 transition hover:bg-cpj-white/5 hover:text-cpj-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal"
        >
          + Novo módulo
        </button>
      )}
    </nav>
  )
}
