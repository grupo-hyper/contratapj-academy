/**
 * AuthorPage — CMS do autor (rota /autor), F1: EDITOR DE AULA.
 *
 * Master–detail: à esquerda a AuthorTree (Módulos ▸ Aulas), à direita o
 * LessonEditor da aula selecionada. Sem recarregar a página.
 *
 * Guarda de "alterações não salvas": o editor reporta o estado sujo por
 * `onDirtyChange`; guardamos num ref e, ao trocar de aula com o ref true,
 * pedimos confirmação (window.confirm) antes de descartar.
 *
 * F1 não cria/exclui/reordena (isso é F2) nem edita quiz (F3).
 */
import { useCallback, useRef, useState } from 'react'
import { AuthorTree } from './AuthorTree'
import { LessonEditor } from './LessonEditor'
import { useAuthorTree } from './useAuthorTree'

function AuthorSkeleton() {
  return (
    <div className="flex animate-pulse gap-6 p-6">
      <div className="h-96 w-72 rounded-2xl bg-cpj-navy/40" />
      <div className="h-96 flex-1 rounded-2xl bg-cpj-navy/40" />
    </div>
  )
}

export function AuthorPage() {
  const { modules, lessonsByModule, isLoading, isError } = useAuthorTree()
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  // Estado sujo do editor atual, sem re-render do pai a cada tecla.
  const dirtyRef = useRef(false)

  const onDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty
  }, [])

  const selectLesson = (lessonId: string) => {
    if (lessonId === selectedLessonId) return
    if (dirtyRef.current) {
      const ok = window.confirm(
        'Você tem alterações não salvas nesta aula. Descartar e trocar?',
      )
      if (!ok) return
    }
    dirtyRef.current = false
    setSelectedLessonId(lessonId)
  }

  // Resolve a aula selecionada varrendo os grupos (a árvore é pequena).
  const selectedLesson = selectedLessonId
    ? Object.values(lessonsByModule)
        .flat()
        .find((l) => l.id === selectedLessonId) ?? null
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
        {/* Painel esquerdo: árvore. */}
        <aside className="rounded-2xl border border-cpj-white/10 bg-cpj-navy/10 p-3">
          <h1 className="mb-3 px-2 text-sm font-bold uppercase tracking-wide text-cpj-white/50">
            Conteúdo
          </h1>
          {isError ? (
            <p className="px-2 text-sm text-cpj-coral">
              Não foi possível carregar o conteúdo (sem acesso ou falha de rede).
            </p>
          ) : (
            <AuthorTree
              modules={modules}
              lessonsByModule={lessonsByModule}
              selectedLessonId={selectedLessonId}
              onSelectLesson={selectLesson}
            />
          )}
        </aside>

        {/* Painel direito: editor ou placeholder. `key` remonta ao trocar. */}
        <section className="rounded-2xl border border-cpj-white/10 bg-cpj-navy/10 p-4 md:p-6">
          {selectedLesson ? (
            <LessonEditor
              key={selectedLesson.id}
              lesson={selectedLesson}
              onDirtyChange={onDirtyChange}
            />
          ) : (
            <div className="flex h-full min-h-[16rem] items-center justify-center text-center text-cpj-white/50">
              Selecione uma aula na árvore para editar.
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default AuthorPage
