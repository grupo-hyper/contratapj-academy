/**
 * Tile - card de modulo/aula dentro de uma Row horizontal (Editorial Noir).
 * Presentational e prop-driven: sem fetch, sem rota. Acao via `onClick`.
 *
 * Tres estados visuais:
 *  - done    -> concluido (selo royal + check)
 *  - current -> ativo/proximo (selo coral pulsante, halo coral, clicavel)
 *  - locked  -> bloqueado (veu + cadeado, capa dessaturada, nao-acionavel)
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
   * Ordem do modulo (1 a 12) para a capa esculpida quando nao ha `coverUrl`.
   * Omitido -> placeholder liso (aulas, por exemplo).
   */
  glyphOrder?: number
  /** Progresso 0 a 100. So renderiza a barra quando informado. */
  progressPct?: number
  /** Ignorado no estado locked (tile nao e acionavel). */
  onClick?: () => void
}

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="10" height="10">
    <path
      d="m4.5 12.5 5 5 10-11"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="18" height="18">
    <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" stroke="#aab2d8" strokeWidth="2" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="#aab2d8" strokeWidth="2" />
    <circle cx="12" cy="15.4" r="1.6" fill="#aab2d8" />
  </svg>
)

const stateClass: Record<TileState, string> = {
  done: 'is-done',
  current: 'is-now',
  locked: 'is-locked',
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
      className={['en-card', stateClass[state]].join(' ')}
    >
      <div className="en-covwrap">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="en-cov" loading="lazy" />
        ) : glyphOrder !== undefined ? (
          <CourseGlyph order={glyphOrder} />
        ) : (
          <div
            className="en-cov"
            style={{
              background:
                'linear-gradient(140deg, #131b4d, #0a0f30 55%, #04061a)',
            }}
          />
        )}

        {state === 'done' && (
          <span className="en-badge done" aria-label="Concluído">
            <CheckIcon />
            Concluído
          </span>
        )}
        {state === 'current' && (
          <span className="en-badge now" aria-label="Em andamento">
            <i aria-hidden="true" />
            Em andamento
          </span>
        )}
        {locked && (
          <>
            <span className="en-badge lock" aria-label="Bloqueado">
              Bloqueado
            </span>
            <div className="en-lockveil" aria-hidden="true">
              <span className="en-lockchip">
                <LockIcon />
              </span>
            </div>
          </>
        )}
      </div>

      <div className="en-card-meta">
        {subtitle && (
          <div className="en-cm-top">
            <span className="en-cm-num">{subtitle}</span>
          </div>
        )}
        <div className="en-cm-title">{title}</div>
        {progressPct !== undefined && (
          <div style={{ marginTop: 10 }}>
            <ProgressBar value={progressPct} />
          </div>
        )}
      </div>
    </button>
  )
}
