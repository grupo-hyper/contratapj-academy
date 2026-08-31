/**
 * Fontes da marca (self-hosted via @fontsource — offline-safe para o PWA).
 * Outfit  → títulos/kickers (font-display no Tailwind).
 * Plus Jakarta Sans → corpo (font-sans no Tailwind).
 *
 * Importado UMA vez em main.tsx. As variáveis (`*-Variable`) trazem todos os
 * pesos num único arquivo, com `font-display: swap` (fallback system enquanto
 * carrega) — o Vite empacota os .woff2 no bundle, sem depender do Google Fonts.
 */
import '@fontsource-variable/outfit'
import '@fontsource-variable/plus-jakarta-sans'
