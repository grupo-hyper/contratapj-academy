/**
 * AreaTrilhaPage — trilha de uma Área específica (Task 6, Fase 1 de Áreas),
 * rota `/area/:slug`.
 *
 * Responsabilidade ÚNICA desta página: resolver `:slug` -> `Area` (via
 * `useAreas`) e delegar a renderização da trilha para a `HomePage` já
 * existente, passando `areaId` (Task 5 já ensinou `useHomeData` a filtrar
 * módulos por área). Não há UI de trilha duplicada aqui — a `HomePage`
 * continua sendo a ÚNICA fonte da composição visual (Hero + Row + Tile);
 * esta página é só o "resolvedor" de slug.
 *
 * Menor-churn: em vez de extrair uma `TrilhaView` reusável, a `HomePage`
 * ganhou um prop opcional `areaId` (ver `HomePage.tsx`) — quando ausente,
 * comporta-se exatamente como antes (trilha completa no hub `/`).
 */
import { Link, useParams } from 'react-router-dom'
import { HomePage } from '../home/HomePage'
import { useAreas } from './useAreas'

export function AreaTrilhaPage() {
  const { slug } = useParams<{ slug: string }>()
  const { areas, isLoading } = useAreas()

  if (isLoading) {
    return (
      <main className="ocean-bg min-h-screen text-cpj-white">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center text-cpj-white/70">
          <p className="text-lg font-semibold text-cpj-white">Carregando…</p>
        </div>
      </main>
    )
  }

  const area = areas.find((a) => a.slug === slug)

  if (!area) {
    return (
      <main className="ocean-bg min-h-screen text-cpj-white">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center text-cpj-white/70">
          <p className="text-lg font-semibold text-cpj-white">Área não encontrada.</p>
          <p className="mt-2 text-sm">
            <Link to="/" className="underline hover:text-cpj-white">
              Voltar para o hub
            </Link>
          </p>
        </div>
      </main>
    )
  }

  return <HomePage areaId={area.id} />
}
