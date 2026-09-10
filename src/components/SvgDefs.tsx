/**
 * SvgDefs - bloco unico de <defs> SVG compartilhado (gradientes, glows,
 * patterns e filtros) usado pelas capas geradas (CourseGlyph) e pelo Hero.
 * Montado UMA vez no shell (AppLayout) para nao repetir os defs por card.
 * Puro apresentacional, sem props. SVG oculto (width/height 0), aria-hidden.
 */
const DEFS = `
  <linearGradient id="gA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9AA8FF"/><stop offset=".55" stop-color="#4259DF"/><stop offset="1" stop-color="#26339B"/></linearGradient>
  <linearGradient id="gB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB0BA"/><stop offset=".55" stop-color="#DE5968"/><stop offset="1" stop-color="#9E3341"/></linearGradient>
  <linearGradient id="gC" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9d2ff"/><stop offset="1" stop-color="#7B8CFF"/></linearGradient>
  <linearGradient id="bgR1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#131b4d"/><stop offset=".55" stop-color="#0a0f30"/><stop offset="1" stop-color="#04061a"/></linearGradient>
  <linearGradient id="bgR2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a2360"/><stop offset=".6" stop-color="#0b1136"/><stop offset="1" stop-color="#03051500"/></linearGradient>
  <linearGradient id="bgC1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a1030"/><stop offset=".5" stop-color="#1c0d33"/><stop offset="1" stop-color="#060518"/></linearGradient>
  <linearGradient id="bgC2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#471426"/><stop offset=".55" stop-color="#200a2e"/><stop offset="1" stop-color="#050417"/></linearGradient>
  <linearGradient id="bgM1" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#0a0f30"/><stop offset=".55" stop-color="#231041"/><stop offset="1" stop-color="#3d1230"/></linearGradient>
  <radialGradient id="glowR" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#4259DF" stop-opacity=".65"/><stop offset="1" stop-color="#4259DF" stop-opacity="0"/></radialGradient>
  <radialGradient id="glowC" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#DE5968" stop-opacity=".6"/><stop offset="1" stop-color="#DE5968" stop-opacity="0"/></radialGradient>
  <radialGradient id="glowW" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f4f6ff" stop-opacity=".28"/><stop offset="1" stop-color="#f4f6ff" stop-opacity="0"/></radialGradient>
  <pattern id="hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="none"/><line x1="0" y1="0" x2="0" y2="7" stroke="rgba(244,246,255,.05)" stroke-width="1"/></pattern>
  <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="rgba(244,246,255,.08)"/></pattern>
  <filter id="fD" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#000" flood-opacity=".65"/></filter>
  <filter id="fGlowR" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#4259DF" flood-opacity=".8"/></filter>
  <filter id="fGlowC" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#DE5968" flood-opacity=".8"/></filter>
`

export function SvgDefs() {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      style={{ position: 'absolute' }}
      dangerouslySetInnerHTML={{ __html: `<defs>${DEFS}</defs>` }}
    />
  )
}
