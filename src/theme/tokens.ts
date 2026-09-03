/**
 * ContrataPJ Academy — brand design tokens (dark / streaming theme).
 * Single source of truth for brand colors. The Tailwind config derives its
 * `cpj` color namespace from this object so the two never drift.
 */
export const cpjColors = {
  bg: '#000000',
  navy: '#1C265E',
  royal: '#4259DF',
  coral: '#DE5968',
  white: '#f4f6ff',
} as const

export type CpjColorName = keyof typeof cpjColors
