/**
 * Tile — card de módulo/aula dentro de uma Row horizontal (dark / streaming).
 * Presentational e prop-driven: sem fetch, sem rota. Ação via `onClick`.
 *
 * Três estados visuais:
 *  - done    → concluído (acento royal + check)
 *  - current → ativo/próximo (acento coral, mais destacado, claramente clicável)
 *  - locked  → bloqueado (dessaturado, cadeado, não-acionável)
 */
import { CourseGlyph } from './CourseGlyph'
import { ProgressBar } from './ProgressBar'

export type TileState = 'done' | 'current' | 'locked'

interface TileProps {
  title: string
  state: TileState
  subtitle?: string
  coverUrl?: string
  /**
   * Ordem do módulo (1–12) para a ilustração esculpida no placeholder quando
   * não há `coverUrl`. Omitido → placeholder oceânico liso (aulas, p.ex.).
   */
  glyphOrder?: number
  /** Progresso 0–100. Só renderiza a barra quando informado. */
  progressPct?: number
  /** Ignorado no estado locked (tile não é acionável). */
  onClick?: () => void
}

const CheckIcon = () => (
  <svg
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
    className="h-3.5 w-3.5"
  >
    <path
      fillRule="evenodd"
      d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.1 3.1 6.8-6.8a1 1 0 0 1 1.4 0Z"
      clipRule="evenodd"
    />
  </svg>
)

const LockIcon = () => (
  <svg
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
    className="h-3.5 w-3.5"
  >
    <path
      fillRule="evenodd"
      d="M10 1a4 4 0 0 0-4 4v2H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-1V5a4 4 0 0 0-4-4Zm2 6V5a2 2 0 1 0-4 0v2h4Z"
      clipRule="evenodd"
    />
  </svg>
)

const stateRing: Record<TileState, string> = {
  done: 'ring-1 ring-cpj-white/25',
  current: 'ring-2 ring-cpj-coral',
  locked: 'ring-1 ring-cpj-white/10',
}

export function Tile({
  title,
  state,
  subtitle,
  coverUrl,
  glyphOrder,
  progressPct,
  onClick,
}: TileProps) {
  const locked = state === 'locked'

  return (
    <button
      type="button"
      onClick={locked ? undefined : onClick}
      aria-disabled={locked || undefined}
      tabIndex={0}
      className={[
        'group ocean-glass relative flex w-40 shrink-0 flex-col overflow-hidden rounded-xl text-left transition-transform duration-200 ease-out sm:w-48',
        stateRing[state],
        locked
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer hover:-translate-y-1 hover:shadow-[0_10px_34px_-8px_rgb(0_0_0_/_0.65)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-white/40',
      ].join(' ')}
    >
      {/* Capa */}
      <div className="relative aspect-video w-full overflow-hidden bg-cpj-navy/60">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : glyphOrder !== undefined ? (
          // Ilustração esculpida do módulo (direção Blue Ocean).
          <CourseGlyph order={glyphOrder} />
        ) : (
          // Placeholder "oceânico" liso: degradê marinho + glow radial central.
          <div className="relative h-full w-full bg-gradient-to-br from-cpj-navy via-cpj-navy/60 to-cpj-bg">
            <div className="absolute inset-0 bg-[radial-gradient(70%_70%_at_50%_35%,rgb(66_89_223_/_0.35),transparent_70%)]" />
          </div>
        )}

        {/* Selo de estado (canto superior) */}
        {state === 'done' && (
          <span
            aria-label="Concluído"
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-cpj-white/20 bg-black/60 text-cpj-white"
          >
            <CheckIcon />
          </span>
        )}
        {locked && (
          <span
            aria-label="Bloqueado"
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-cpj-bg/80 text-cpj-white/80"
          >
            <LockIcon />
          </span>
        )}
      </div>

      {/* Corpo */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        {subtitle && (
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-cpj-white/50">
            {subtitle}
          </span>
        )}
        <span className="line-clamp-2 text-sm font-semibold text-cpj-white">
          {title}
        </span>
        {progressPct !== undefined && (
          <div className="mt-auto pt-2">
            <ProgressBar value={progressPct} />
          </div>
        )}
      </div>
    </button>
  )
}
