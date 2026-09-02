/**
 * AuthorTree — painel ESQUERDO do CMS: a árvore Módulos ▸ Aulas (leitura).
 *
 * Só navegação: cada aula é um botão que dispara `onSelectLesson(id)`. Marca
 * rascunhos com um selo e destaca a aula selecionada (`aria-current`). F1 não
 * cria/reordena — isso chega na F2.
 */
import type { Lesson, Module } from '../../types/content'

interface AuthorTreeProps {
  modules: Module[]
  lessonsByModule: Record<string, Lesson[]>
  selectedLessonId: string | null
  onSelectLesson: (lessonId: string) => void
}

function DraftBadge() {
  return (
    <span className="ml-2 rounded-full bg-cpj-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cpj-white/60">
      rascunho
    </span>
  )
}

export function AuthorTree({
  modules,
  lessonsByModule,
  selectedLessonId,
  onSelectLesson,
}: AuthorTreeProps) {
  return (
    <nav aria-label="Módulos e aulas" className="flex flex-col gap-4">
      {modules.map((module) => {
        const lessons = lessonsByModule[module.id] ?? []
        return (
          <div key={module.id}>
            <div className="flex items-center px-2 text-sm font-semibold text-cpj-white/80">
              <span className="tabular-nums text-cpj-white/40">
                {module.ordem}.
              </span>
              <span className="ml-2">{module.titulo}</span>
              {!module.publicado && <DraftBadge />}
            </div>
            <ul className="mt-1 flex flex-col">
              {lessons.length === 0 && (
                <li className="px-4 py-1 text-xs text-cpj-white/40">
                  (sem aulas)
                </li>
              )}
              {lessons.map((lesson) => {
                const isSelected = lesson.id === selectedLessonId
                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      onClick={() => onSelectLesson(lesson.id)}
                      aria-current={isSelected ? 'true' : undefined}
                      className={`flex w-full items-center rounded-lg px-4 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal ${
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
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}
