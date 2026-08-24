/**
 * Row — faixa horizontal rolável (padrão "row" de streaming).
 * Presentational: recebe `title` e os tiles como `children`.
 */
import type { ReactNode } from 'react'

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
        className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]"
        role="list"
      >
        {children}
      </div>
    </section>
  )
}
