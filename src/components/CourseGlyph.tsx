/**
 * CourseGlyph — ilustração "esculpida" por módulo (direção Blue Ocean).
 *
 * Presentational e offline: um glyph vetorial temático por módulo dentro de um
 * medalhão glass com glow radial + rim de luz + sombra interna, dando o efeito
 * 3D-ish monocromático azul da referência SEM assets raster (bom p/ PWA e sync).
 *
 * O glyph é escolhido por `order` (1–12, a `ordem` do módulo — títulos fixos em
 * MODULE_TITLES do seed). Fora do intervalo cai no glyph genérico (bússola).
 * Puro SVG com stroke em gradiente royal→branco; a marca não muda.
 */
import type { ReactNode } from 'react'

/**
 * Glyphs desenhados à mão em viewBox 24×24, stroke 1.75, cantos/juntas
 * arredondados — linguagem visual única entre todos os módulos.
 *  1 Prospecção · 2 Abordagem · 3 Diagnóstico · 4 Proposta · 5 Objeções
 *  6 Fechamento · 7 Follow-up · 8 Gestão · 9 Frameworks · 10 Scripts
 *  11 Antipadrões · 12 Números
 */
const GLYPHS: Record<number, ReactNode> = {
  // Prospecção — radar/alvo
  1: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
    </>
  ),
  // Abordagem — balão de conversa
  2: (
    <>
      <path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.5V16.5H4A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5Z" />
      <path d="M7 10h10M7 13h6" />
    </>
  ),
  // Diagnóstico — lupa
  3: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.2 15.2 21 21" />
      <path d="M8 10.5h5M10.5 8v5" />
    </>
  ),
  // Proposta — documento com dobra
  4: (
    <>
      <path d="M6 2.5h7l5 5V20a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V4A1.5 1.5 0 0 1 6 2.5Z" />
      <path d="M13 2.5V8h5" />
      <path d="M8 13h8M8 16.5h5" />
    </>
  ),
  // Objeções — escudo
  5: (
    <>
      <path d="M12 2.5 20 5.5v6c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10v-6Z" />
      <path d="m8.8 12 2.2 2.2 4.2-4.4" />
    </>
  ),
  // Fechamento — selo com check
  6: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.8 2.8L16 9" />
    </>
  ),
  // Follow-up — relógio com seta de retorno
  7: (
    <>
      <circle cx="12" cy="12.5" r="7.5" />
      <path d="M12 8.5v4l2.5 2" />
      <path d="M5 4.5v3.5h3.5" />
    </>
  ),
  // Gestão — sliders
  8: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="2" fill="#0a0a0c" />
      <circle cx="15" cy="12" r="2" fill="#0a0a0c" />
      <circle cx="8" cy="17" r="2" fill="#0a0a0c" />
    </>
  ),
  // Frameworks — camadas
  9: (
    <>
      <path d="M12 3 21 8l-9 5-9-5Z" />
      <path d="m3 12.5 9 5 9-5" />
      <path d="m3 16.5 9 5 9-5" />
    </>
  ),
  // Scripts — balão com </>
  10: (
    <>
      <path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.5V16.5H4A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5Z" />
      <path d="m10 9-2.5 2.5L10 14M14 9l2.5 2.5L14 14" />
    </>
  ),
  // Antipadrões — triângulo de alerta
  11: (
    <>
      <path d="M12 3.5 22 20H2Z" />
      <path d="M12 9.5v4.5" />
      <path d="M12 17h.01" />
    </>
  ),
  // Números — gráfico de barras
  12: (
    <>
      <path d="M4 20.5V21h16" />
      <path d="M7 20V11M12 20V5M17 20v-6" />
    </>
  ),
}

// Genérico (fallback) — bússola.
const FALLBACK: ReactNode = (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5Z" />
  </>
)

interface CourseGlyphProps {
  /** `ordem` do módulo (1–12). Fora do intervalo usa o glyph genérico. */
  order: number
  /** Classe extra para o wrapper (ex.: tamanho da medalha). */
  className?: string
}

export function CourseGlyph({ order, className }: CourseGlyphProps) {
  const glyph = GLYPHS[order] ?? FALLBACK

  return (
    <div
      className={[
        'relative grid h-full w-full place-items-center overflow-hidden',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      {/* Fundo oceânico do card */}
      <div className="absolute inset-0 bg-gradient-to-br from-cpj-navy via-cpj-navy/60 to-cpj-bg" />
      <div className="absolute inset-0 bg-[radial-gradient(70%_70%_at_50%_32%,rgb(66_89_223_/_0.38),transparent_70%)]" />

      {/* Medalhão esculpido: rim de luz no topo + sombra interna embaixo + glow. */}
      <div
        className="relative flex aspect-square w-[42%] max-w-16 items-center justify-center rounded-2xl border border-cpj-white/15"
        style={{
          background:
            'radial-gradient(120% 120% at 30% 18%, rgb(66 89 223 / 0.6), rgb(28 38 94 / 0.18))',
          boxShadow:
            'inset 0 1px 0 rgb(244 246 255 / 0.35), inset 0 -9px 16px rgb(10 10 12 / 0.6), 0 8px 22px -6px rgb(66 89 223 / 0.55)',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-[58%] w-[58%]"
          style={{ filter: 'drop-shadow(0 2px 4px rgb(10 10 12 / 0.65))' }}
        >
          <defs>
            <linearGradient id="cpj-glyph" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f4f6ff" />
              <stop offset="1" stopColor="#8fa2ff" />
            </linearGradient>
          </defs>
          <g
            stroke="url(#cpj-glyph)"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {glyph}
          </g>
        </svg>
      </div>
    </div>
  )
}
