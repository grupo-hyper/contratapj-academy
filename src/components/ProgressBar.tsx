/**
 * ProgressBar — barra de progresso horizontal (dark / streaming).
 * Presentational: só recebe `value` (0–100). Faz clamp de valores fora do range.
 * Acessível: role="progressbar" + aria-valuenow/min/max.
 */

interface ProgressBarProps {
  /** Progresso de 0 a 100. Valores fora do range são clampados. */
  value: number
  /** Rótulo opcional; quando presente vira também o aria-label da barra. */
  label?: string
  className?: string
}

function clamp(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}

export function ProgressBar({ value, label, className }: ProgressBarProps) {
  const pct = clamp(value)

  return (
    <div className={className}>
      {label && (
        <div className="mb-1 flex items-center justify-between text-xs text-cpj-white/70">
          <span>{label}</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full overflow-hidden rounded-full bg-cpj-white/15"
      >
        <div
          className="h-full rounded-full bg-cpj-royal transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
