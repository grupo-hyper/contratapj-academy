/**
 * Row — faixa horizontal rolável (padrão "row" de streaming).
 * Presentational: recebe `title` e os tiles como `children`.
 *
 * Setas de navegação (hover) substituem a scrollbar como affordance
 * primária: aparecem só no lado em que ainda há conteúdo pra rolar,
 * e cada clique avança ~90% da largura visível.
 */
import { Children, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

interface RowProps {
  title: string
  children: ReactNode
  className?: string
}

const SCROLL_STEP_RATIO = 0.9

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M12.7 4.3a1 1 0 0 1 0 1.4L8.42 10l4.3 4.3a1 1 0 1 1-1.42 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.42 0Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M7.3 15.7a1 1 0 0 1 0-1.4L11.58 10l-4.3-4.3a1 1 0 1 1 1.42-1.4l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.42 0Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

const arrowClassName =
  'absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-cpj-bg/80 text-cpj-white opacity-0 shadow-lg ring-1 ring-cpj-white/15 transition-opacity duration-200 hover:bg-cpj-bg focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-white/40 group-hover/row:opacity-100'

export function Row({ title, children, className }: RowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  // Recalcula quando os tiles mudam (nova trilha) e quando a janela redimensiona
  // (o overflow depende da largura visível, não só da lista de children).
  useEffect(() => {
    updateScrollState()
    window.addEventListener('resize', updateScrollState)
    return () => window.removeEventListener('resize', updateScrollState)
  }, [updateScrollState, children])

  const scrollByStep = (direction: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * SCROLL_STEP_RATIO, behavior: 'smooth' })
  }

  return (
    <section className={['group/row flex flex-col gap-3', className].filter(Boolean).join(' ')}>
      <h2 className="text-lg font-bold tracking-tight text-cpj-white">
        {title}
      </h2>
      <div className="relative">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollByStep(-1)}
            aria-label="Rolar para a esquerda"
            className={`left-0 ${arrowClassName}`}
          >
            <ChevronLeftIcon />
          </button>
        )}

        <div
          ref={scrollerRef}
          onScroll={updateScrollState}
          className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]"
          role="list"
        >
          {/* Envolve cada tile num listitem para manter semântica list/listitem
              válida — os leitores de tela descartam um `list` sem `listitem`. */}
          {Children.map(children, (child) => (
            <div role="listitem" className="contents">
              {child}
            </div>
          ))}
        </div>

        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollByStep(1)}
            aria-label="Rolar para a direita"
            className={`right-0 ${arrowClassName}`}
          >
            <ChevronRightIcon />
          </button>
        )}
      </div>
    </section>
  )
}
