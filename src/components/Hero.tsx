/**
 * Hero — banner "continue assistindo" (dark / streaming).
 * Presentational: ação primária via `onAction`. Sem fetch, sem rota.
 */
import { ProgressBar } from './ProgressBar'

interface HeroProps {
  title: string
  subtitle?: string
  backgroundUrl?: string
  /** Progresso 0–100 do item em andamento. */
  progressPct?: number
  actionLabel: string
  onAction: () => void
}

export function Hero({
  title,
  subtitle,
  backgroundUrl,
  progressPct,
  actionLabel,
  onAction,
}: HeroProps) {
  return (
    <section className="ocean-glass relative overflow-hidden rounded-2xl">
      {/* Fundo */}
      <div className="absolute inset-0">
        {backgroundUrl ? (
          <img
            src={backgroundUrl}
            alt=""
            className="h-full w-full object-cover object-[center_top]"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-cpj-navy via-cpj-bg to-cpj-bg" />
        )}
        {/* Gradiente escuro para legibilidade do texto (preto → transparente).
            Sem glow azul: o chrome fica preto para contrastar com a arte azul. */}
        <div className="absolute inset-0 bg-gradient-to-r from-cpj-bg via-cpj-bg/85 to-cpj-bg/20" />
      </div>

      {/* Conteúdo */}
      <div className="relative flex max-w-xl flex-col gap-4 p-6 sm:p-10">
        <span className="text-xs font-semibold uppercase tracking-widest text-cpj-coral">
          Continue de onde parou
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-cpj-white sm:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="max-w-prose text-sm text-cpj-white/80 sm:text-base">
            {subtitle}
          </p>
        )}
        {progressPct !== undefined && (
          <ProgressBar value={progressPct} className="max-w-xs" />
        )}
        <div>
          <button
            type="button"
            onClick={onAction}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-cpj-coral px-6 py-3 font-semibold text-cpj-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-coral focus-visible:ring-offset-2 focus-visible:ring-offset-cpj-bg"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className="h-4 w-4"
            >
              <path d="M6.3 3.7A1 1 0 0 0 4.8 4.6v10.8a1 1 0 0 0 1.5.9l9-5.4a1 1 0 0 0 0-1.7l-9-5.5Z" />
            </svg>
            {actionLabel}
          </button>
        </div>
      </div>
    </section>
  )
}
