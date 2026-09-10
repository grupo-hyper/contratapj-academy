/**
 * Hero - banner "continue de onde parou" (Editorial Noir).
 * Presentational: acao primaria via `onAction`. Sem fetch, sem rota.
 */

const HERO_ART =
  '<rect width="1200" height="460" fill="url(#hatch)"/><rect width="1200" height="460" fill="url(#dots)" opacity=".5"/><circle cx="1060" cy="90" r="330" fill="url(#glowC)" opacity=".55"/><circle cx="930" cy="420" r="300" fill="url(#glowR)" opacity=".6"/>'

interface HeroProps {
  title: string
  subtitle?: string
  backgroundUrl?: string
  /** Progresso 0 a 100 do item em andamento. */
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
    <section className="en-hero">
      {backgroundUrl ? (
        <img
          className="en-hero-art"
          src={backgroundUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <svg
          className="en-hero-art"
          viewBox="0 0 1200 460"
          preserveAspectRatio="xMaxYMid slice"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: HERO_ART }}
        />
      )}

      <div className="en-hero-inner">
        <span className="en-eyebrow">Continue de onde parou</span>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}

        {progressPct !== undefined && (
          <div className="en-hero-progress">
            <div className="en-hp-meta">
              <span>Progresso do módulo</span>
              <b>{progressPct}%</b>
            </div>
            <div
              className="en-bar"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progresso: ${progressPct}%`}
            >
              <i style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        <div className="en-hero-cta">
          <button className="en-btn-primary" type="button" onClick={onAction}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="16" height="16">
              <path
                d="M7 4.8v14.4c0 .9 1 1.5 1.8 1L20 13a1.2 1.2 0 0 0 0-2L8.8 3.8C8 3.3 7 3.9 7 4.8Z"
                fill="#1a0b0e"
              />
            </svg>
            {actionLabel}
          </button>
        </div>
      </div>
    </section>
  )
}
