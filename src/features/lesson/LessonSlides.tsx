/**
 * LessonSlides — apresenta o conteúdo em texto da aula como SLIDES (uma seção
 * `## N.` por vez) em vez de um fluxo corrido.
 *
 * Regra de navegação (pedido do Diego):
 *  - "Anterior" é IMEDIATO (nunca bloqueado);
 *  - "Próximo" só libera 10s APÓS o slide aparecer — o bloqueio re-arma toda vez
 *    que o slide é exibido (inclusive ao voltar e avançar de novo), com contagem
 *    regressiva visível no botão.
 *
 * Reaproveita o render (identidade das propostas) via <LessonMarkdown>. Quando a
 * aula tem uma seção só (ou nenhuma), não há navegação — mostra o conteúdo puro.
 */
import { useEffect, useMemo, useState } from 'react'
import { LessonMarkdown } from './lessonMarkdown'
import { splitIntoSlides } from './lessonSlides'

/** Segundos de bloqueio do "Próximo" a cada slide. */
export const SLIDE_UNLOCK_SECONDS = 5

interface LessonSlidesProps {
  markdown: string | null
  /**
   * Quando false, o "Próximo" nunca é bloqueado por tempo (navegação livre).
   * Usado no PREVIEW do editor do autor. Default true (comportamento do player).
   */
  gated?: boolean
}

export function LessonSlides({ markdown, gated = true }: LessonSlidesProps) {
  const slides = useMemo(() => splitIntoSlides(markdown), [markdown])
  const [index, setIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(SLIDE_UNLOCK_SECONDS)

  const total = slides.length
  const isLast = index >= total - 1

  // Re-arma o gate a cada slide. No último slide, ou quando o gate está
  // desligado (preview do autor), não há contagem: libera na hora.
  useEffect(() => {
    if (isLast || !gated) {
      setSecondsLeft(0)
      return
    }
    setSecondsLeft(SLIDE_UNLOCK_SECONDS)
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [index, isLast, gated])

  if (total === 0) {
    return (
      <p className="text-sm text-cpj-white/60">
        Esta aula ainda não tem material em texto.
      </p>
    )
  }

  const canAdvance = secondsLeft === 0
  const goPrev = () => setIndex((i) => Math.max(0, i - 1))
  const goNext = () => {
    if (canAdvance) setIndex((i) => Math.min(total - 1, i + 1))
  }

  // Uma seção só: sem navegação, conteúdo direto.
  if (total === 1) {
    return <LessonMarkdown markdown={slides[0]} />
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Conteúdo do slide atual. `key` força remonte → scroll/estado limpo. */}
      <div key={index} className="min-h-[8rem]">
        <LessonMarkdown markdown={slides[index]} />
      </div>

      {/* Controles de navegação. */}
      <div className="flex items-center justify-between gap-3 border-t border-cpj-white/10 pt-4">
        <button
          type="button"
          onClick={goPrev}
          disabled={index === 0}
          className="rounded-xl border border-cpj-white/15 px-4 py-2.5 text-sm font-semibold text-cpj-white/90 transition hover:bg-cpj-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Anterior
        </button>

        <span
          className="font-display text-sm font-semibold tabular-nums text-cpj-white/60"
          aria-label={`Slide ${index + 1} de ${total}`}
        >
          {index + 1} / {total}
        </span>

        {isLast ? (
          <span className="rounded-xl px-4 py-2.5 text-sm font-semibold text-cpj-white/40">
            Fim
          </span>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={!canAdvance}
            aria-live="polite"
            className="rounded-xl bg-cpj-coral px-4 py-2.5 text-sm font-semibold text-cpj-white transition hover:bg-cpj-coral/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-coral disabled:cursor-not-allowed disabled:opacity-50"
          >
            {canAdvance ? 'Próximo →' : `Próximo em ${secondsLeft}s`}
          </button>
        )}
      </div>
    </div>
  )
}
