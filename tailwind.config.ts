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
    },
  },
  plugins: [],
}

export default config
