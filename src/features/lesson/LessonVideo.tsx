/**
 * LessonVideo — embed do vídeo da aula (Task 3.3). Presentational.
 *
 * Quando há `youtubeId`, renderiza um iframe responsivo 16:9 (via wrapper com
 * aspect-ratio). Usamos o domínio `youtube-nocookie.com` por privacidade.
 * Quando não há id, mostra um placeholder on-brand ("Vídeo em breve").
 *
 * Nota: a auto-conclusão por progresso de vídeo (YouTube IFrame Player API +
 * onStateChange) é uma melhoria FUTURA e está fora de escopo aqui — o seed vem
 * com `youtube_id` vazio e o mecanismo confiável de conclusão é o botão manual
 * "Marcar como concluída" na LessonPage. Por isso usamos um iframe simples.
 */

interface LessonVideoProps {
  youtubeId?: string | null
  /** Título da aula — vira o `title` acessível do iframe. */
  title: string
}

export function LessonVideo({ youtubeId, title }: LessonVideoProps) {
  if (!youtubeId) {
    return (
      <div
        role="img"
        aria-label="Vídeo em breve"
        className="flex aspect-video w-full items-center justify-center rounded-2xl border border-cpj-white/10 bg-cpj-navy/40 text-center"
      >
        <div className="px-6">
          <p className="text-lg font-semibold text-cpj-white">Vídeo em breve</p>
          <p className="mt-1 text-sm text-cpj-white/60">
            Esta aula tem conteúdo em texto abaixo.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl border border-cpj-white/10 bg-black">
      <iframe
        className="h-full w-full"
        src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  )
}
