/**
 * LessonText — render do conteúdo em Markdown da aula em fluxo corrido.
 *
 * O mapa de estilos (identidade das propostas) foi extraído para
 * `lessonMarkdown.tsx` e é compartilhado com `LessonSlides.tsx`. Aqui só
 * tratamos o caso vazio e delegamos o render.
 */
import { LessonMarkdown } from './lessonMarkdown'

interface LessonTextProps {
  markdown: string | null
}

export function LessonText({ markdown }: LessonTextProps) {
  if (!markdown || markdown.trim() === '') {
    return (
      <p className="text-sm text-cpj-white/60">
        Esta aula ainda não tem material em texto.
      </p>
    )
  }

  return <LessonMarkdown markdown={markdown} />
}
