/**
 * Row — faixa horizontal rolável (padrão "row" de streaming).
 * Presentational: recebe `title` e os tiles como `children`.
 */
import { Children, type ReactNode } from 'react'

interface RowProps {
  title: string
  children: ReactNode
  className?: string
}

export function Row({ title, children, className }: RowProps) {
  return (
    <section className={['flex flex-col gap-3', className].filter(Boolean).join(' ')}>
      <h2 className="text-lg font-bold tracking-tight text-cpj-white">
        {title}
      </h2>
      <div
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
    </section>
  )
}
