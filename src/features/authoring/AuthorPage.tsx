/**
 * AuthorPage — CMS do autor (rota /autor), F2: gestão de módulos e aulas.
 *
 * Master–detail: à esquerda a AuthorTree (Módulos ▸ Aulas), à direita o editor
 * do item selecionado — ModuleEditor (módulo) OU LessonEditor (aula). Todas as
 * mutations (criar/excluir/reordenar/editar módulo) vêm do useAuthorMutations.
 *
 * Guarda de "alterações não salvas": o editor ativo reporta o estado sujo por
 * `onDirtyChange`; guardamos num ref e, ao trocar de item, pedimos confirmação
 * (window.confirm) antes de descartar. Exclusões também pedem confirmação.
 *
 * Reorder: a árvore diz "sobe/desce" (dir); aqui achamos o vizinho na lista
 * ordenada e mandamos o swap seguro (upsert único) pelo useAuthorMutations.
 */
import { useCallback, useRef, useState } from 'react'
import { AuthorTree } from './AuthorTree'
import { LessonEditor } from './LessonEditor'
import { ModuleEditor } from './ModuleEditor'
import { QuizEditor } from './QuizEditor'
import { useAuthorTree } from './useAuthorTree'
import { useAuthorMutations } from './useAuthorMutations'
import type { Lesson, Module } from '../../types/content'

function AuthorSkeleton() {
  return (
    <div className="flex animate-pulse gap-6 p-6">
      <div className="h-96 w-72 rounded-2xl bg-cpj-navy/40" />
      <div className="h-96 flex-1 rounded-2xl bg-cpj-navy/40" />
    </div>
  )
}

/**
 * Seleção corrente: nada, um módulo, uma aula ou o quiz de um módulo
 * (mutuamente exclusivas). No caso 'quiz', `id` é o module_id.
 */
type Selection =
  | { kind: 'none' }
  | { kind: 'module'; id: string }
  | { kind: 'lesson'; id: string }
  | { kind: 'quiz'; id: string }

export function AuthorPage() {
  const { modules, lessonsByModule, isLoading, isError } = useAuthorTree()
  const {
    createModule,
    updateModule,
    deleteModule,
    createLesson,
    deleteLesson,
    reorderModules,
    reorderLessons,
    isMutating,
    isMutationError,
  } = useAuthorMutations()

  const [selection, setSelection] = useState<Selection>({ kind: 'none' })
  // Estado sujo do editor atual, sem re-render do pai a cada tecla.
  const dirtyRef = useRef(false)

  const onDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty
  }, [])

  /** Guarda comum: confirma o descarte se o editor atual estiver sujo. */
  const guardDiscard = (): boolean => {
    if (!dirtyRef.current) return true
    const ok = window.confirm(
      'Você tem alterações não salvas. Descartar e trocar?',
    )
    if (ok) dirtyRef.current = false
    return ok
  }

  const selectLesson = (lessonId: string) => {
    if (selection.kind === 'lesson' && selection.id === lessonId) return
    if (!guardDiscard()) return
    dirtyRef.current = false
    setSelection({ kind: 'lesson', id: lessonId })
  }

  const selectModule = (moduleId: string) => {
    if (selection.kind === 'module' && selection.id === moduleId) return
    if (!guardDiscard()) return
    dirtyRef.current = false
    setSelection({ kind: 'module', id: moduleId })
  }

  const selectQuiz = (moduleId: string) => {
    if (selection.kind === 'quiz' && selection.id === moduleId) return
    if (!guardDiscard()) return
    dirtyRef.current = false
    setSelection({ kind: 'quiz', id: moduleId })
  }

  const onDeleteModule = (module: Module) => {
    const ok = window.confirm(
      `Excluir o módulo "${module.titulo}"? As aulas e o quiz dele serão removidos.`,
    )
    if (!ok) return
    // Excluir o módulo derruba tanto a seleção do módulo quanto a do seu quiz.
    if (
      (selection.kind === 'module' || selection.kind === 'quiz') &&
      selection.id === module.id
    ) {
      dirtyRef.current = false
      setSelection({ kind: 'none' })
    }
    deleteModule(module.id)
  }

  const onDeleteLesson = (lesson: Lesson) => {
    const ok = window.confirm(`Excluir a aula "${lesson.titulo}"?`)
    if (!ok) return
    if (selection.kind === 'lesson' && selection.id === lesson.id) {
      dirtyRef.current = false
      setSelection({ kind: 'none' })
    }
    deleteLesson(lesson.id)
  }

  /** Acha o vizinho (na ordem exibida) e dispara o swap seguro de módulos. */
  const onReorderModule = (module: Module, dir: -1 | 1) => {
    const idx = modules.findIndex((m) => m.id === module.id)
    const neighbor = modules[idx + dir]
    if (!neighbor) return
    reorderModules(
      { id: module.id, ordem: module.ordem },
      { id: neighbor.id, ordem: neighbor.ordem },
    )
  }

  /** Idem para aulas, dentro do módulo da aula. */
  const onReorderLesson = (lesson: Lesson, dir: -1 | 1) => {
    const lessons = lessonsByModule[lesson.module_id] ?? []
    const idx = lessons.findIndex((l) => l.id === lesson.id)
    const neighbor = lessons[idx + dir]
    if (!neighbor) return
    reorderLessons(
      { id: lesson.id, ordem: lesson.ordem },
      { id: neighbor.id, ordem: neighbor.ordem },
    )
  }

  // Resolve os itens selecionados varrendo os grupos (a árvore é pequena).
  const selectedLesson =
    selection.kind === 'lesson'
      ? Object.values(lessonsByModule)
          .flat()
          .find((l) => l.id === selection.id) ?? null
      : null
  const selectedModule =
    selection.kind === 'module'
      ? modules.find((m) => m.id === selection.id) ?? null
      : null
  const selectedQuizModule =
    selection.kind === 'quiz'
      ? modules.find((m) => m.id === selection.id) ?? null
      : null

  if (isLoading) {
    return (
      <main className="ocean-bg min-h-screen text-cpj-white">
        <AuthorSkeleton />
      </main>
    )
  }

  return (
    <main className="ocean-bg min-h-screen text-cpj-white">
      <div className="grid gap-6 p-4 md:p-6 lg:grid-cols-[18rem_1fr]">
        {/* Painel esquerdo: árvore. min-w-0 impede que títulos longos + controles
            estourem a faixa de 18rem e invadam o editor. */}
        <aside className="min-w-0 rounded-2xl border border-cpj-white/10 bg-cpj-navy/10 p-3">
          <h1 className="mb-3 px-2 text-sm font-bold uppercase tracking-wide text-cpj-white/50">
            Conteúdo
          </h1>
          {isMutationError && (
            <p className="mb-2 px-2 text-xs text-cpj-coral">
              Alguma operação falhou. Verifique conexão/permissão e tente de novo.
            </p>
          )}
          {isError ? (
            <p className="px-2 text-sm text-cpj-coral">
              Não foi possível carregar o conteúdo (sem acesso ou falha de rede).
            </p>
          ) : (
            <AuthorTree
              modules={modules}
              lessonsByModule={lessonsByModule}
              selectedLessonId={selection.kind === 'lesson' ? selection.id : null}
              selectedModuleId={selection.kind === 'module' ? selection.id : null}
              onSelectLesson={selectLesson}
              onSelectModule={selectModule}
              onCreateModule={createModule}
              onCreateLesson={createLesson}
              onDeleteModule={onDeleteModule}
              onDeleteLesson={onDeleteLesson}
              onReorderModule={onReorderModule}
              onReorderLesson={onReorderLesson}
              onSelectQuiz={selectQuiz}
              selectedQuizModuleId={selection.kind === 'quiz' ? selection.id : null}
            />
          )}
        </aside>

        {/* Painel direito: editor de módulo, de aula, ou placeholder. */}
        <section className="min-w-0 rounded-2xl border border-cpj-white/10 bg-cpj-navy/10 p-4 md:p-6">
          {selectedModule ? (
            <ModuleEditor
              key={selectedModule.id}
              module={selectedModule}
              onSave={updateModule}
              isSaving={isMutating}
              isError={isMutationError}
              onDirtyChange={onDirtyChange}
            />
          ) : selectedLesson ? (
            <LessonEditor
              key={selectedLesson.id}
              lesson={selectedLesson}
              onDirtyChange={onDirtyChange}
            />
          ) : selectedQuizModule ? (
            <QuizEditor
              key={selectedQuizModule.id}
              moduleId={selectedQuizModule.id}
              moduleTitle={selectedQuizModule.titulo}
            />
          ) : (
            <div className="flex h-full min-h-[16rem] items-center justify-center text-center text-cpj-white/50">
              Selecione um módulo, uma aula ou o quiz na árvore para editar.
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default AuthorPage
