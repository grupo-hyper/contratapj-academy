import type { Config } from 'tailwindcss'
import { cpjColors } from './src/theme/tokens'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand namespace — derived from the canonical tokens (single source of truth).
        cpj: cpjColors,
      },
      fontFamily: {
        // Tipografia da marca (deck de propostas). `font-sans` é o corpo padrão;
        // `font-display` (Outfit) para títulos e kickers. Fontes carregadas em
        // src/theme/fonts.ts (@fontsource, offline-safe).
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', 'sans-serif'],
        display: ['"Outfit Variable"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
