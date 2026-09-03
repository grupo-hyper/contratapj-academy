/**
 * AreaHubPage — hub de Áreas (Task 4, Fase 1 de Áreas).
 *
 * Página que ocupará a rota `/` (wiring feito na Task 7 — aqui só o
 * componente). Busca as áreas via `useAreas` e renderiza um grid de
 * `<AreaCard>`, com skeleton no loading, mensagem de erro inline e mensagem
 * de vazio. Renderiza DENTRO do `<AppLayout>` (sidebar/shell já vêm de lá),
 * então este componente é só conteúdo de página — segue a mesma convenção
 * visual (`ocean-bg`, blocos `cpj-*`) de `HomePage.tsx`.
 */
import { useAreas } from './useAreas'
import { AreaCard } from './AreaCard'

/** Esqueleto dark simples enquanto carrega — grid proporcional ao real. */
function AreaHubSkeleton() {
  return (
    <div className="grid animate-pulse gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-52 rounded-2xl bg-cpj-navy/40" />
      ))}
    </div>
  )
}

export function AreaHubPage() {
  const { areas, isLoading, isError } = useAreas()

  return (
    <main className="ocean-bg min-h-screen text-cpj-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        <h1 className="text-2xl font-bold text-cpj-white sm:text-3xl">
          Áreas
        </h1>

        {isLoading ? (
          <AreaHubSkeleton />
        ) : isError ? (
          <div className="mx-auto max-w-6xl px-4 py-16 text-center text-cpj-white/70">
            <p className="text-lg font-semibold text-cpj-white">
              Não foi possível carregar as áreas.
            </p>
            <p className="mt-2 text-sm">Tente recarregar a página em instantes.</p>
          </div>
        ) : areas.length === 0 ? (
          <div className="mx-auto max-w-6xl px-4 py-16 text-center text-cpj-white/70">
            <p className="text-lg font-semibold text-cpj-white">
              Nenhuma área publicada.
            </p>
            <p className="mt-2 text-sm">Volte em breve — o conteúdo está a caminho.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {areas.map((area) => (
              <AreaCard key={area.id} area={area} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
