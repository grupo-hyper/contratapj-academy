/**
 * AreaCard — card de uma Área (Task 3, Fase 1 de Áreas).
 *
 * Presentational e prop-driven: recebe `area: Area` e renderiza um link de
 * navegação para `/area/<slug>`. Sem fetch, sem estado — mesma linha de
 * `Tile.tsx`/`Hero.tsx` (dark / streaming, tokens `cpj-*`, `ocean-glass`).
 *
 * Sem `capa_url`, cai num placeholder com a inicial do nome (não há sistema
 * de glyphs para áreas como há para módulos em `CourseGlyph`).
 */
import { Link } from 'react-router-dom'
import type { Area } from '../../types/content'

interface AreaCardProps {
  area: Area
}

export function AreaCard({ area }: AreaCardProps) {
  const inicial = area.nome.trim().charAt(0).toUpperCase()

  return (
    <Link
      to={`/area/${area.slug}`}
      className="group ocean-glass relative flex flex-col overflow-hidden rounded-2xl ring-1 ring-cpj-white/10 transition-transform duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_10px_34px_-8px_rgb(0_0_0_/_0.65)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-white/40"
    >
      {/* Capa */}
      <div className="relative aspect-video w-full overflow-hidden bg-cpj-navy/60">
        {area.capa_url ? (
          <img
            src={area.capa_url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          // Placeholder: degradê marinho + inicial do nome centralizada.
          <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-cpj-navy via-cpj-navy/60 to-cpj-bg">
            <div className="absolute inset-0 bg-[radial-gradient(70%_70%_at_50%_35%,rgb(66_89_223_/_0.35),transparent_70%)]" />
            <span className="relative text-4xl font-bold text-cpj-white/80">
              {inicial}
            </span>
          </div>
        )}
      </div>

      {/* Corpo */}
      <div className="flex flex-1 flex-col gap-1 p-4">
        <span className="text-base font-semibold text-cpj-white">
          {area.nome}
        </span>
        {area.descricao && (
          <span className="line-clamp-2 text-sm text-cpj-white/60">
            {area.descricao}
          </span>
        )}
      </div>
    </Link>
  )
}
