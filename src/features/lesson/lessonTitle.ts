/**
 * Helpers do cabeçalho da aula: separam o "PB-MM.NN — Título" (que vive no 1º
 * h1 do markdown) em kicker (ex.: "PB-02 · Abordagem") + título limpo, e removem
 * esse h1 do corpo para não duplicar com o cabeçalho da página.
 *
 * O número do módulo (MM) só existe no h1 do texto_md — `lesson.titulo` já vem
 * sem o prefixo. Por isso parseamos a 1ª linha do markdown.
 */

/** Nomes oficiais dos 12 módulos (espelha scripts/seed-lessons.ts). */
export const MODULE_TITLES: Record<number, string> = {
  1: 'Prospecção',
  2: 'Abordagem',
  3: 'Diagnóstico',
  4: 'Proposta',
  5: 'Objeções',
  6: 'Fechamento',
  7: 'Follow-up',
  8: 'Gestão',
  9: 'Frameworks',
  10: 'Scripts',
  11: 'Antipadrões',
  12: 'Números',
}

export interface LessonHeading {
  /** Ex.: "PB-02 · Abordagem" (ou só "PB-02" se o módulo for desconhecido). */
  kicker: string
  /** Título limpo, sem o prefixo "PB-MM.NN — ". */
  titulo: string
}

// `# PB-02.01 — Título` (aceita #, e travessão — / en-dash – / hífen -).
const H1_PB = /^\s*#?\s*PB-(\d{1,2})\.(\d{1,2})\s*[—–-]\s*(.+?)\s*$/

/**
 * Extrai kicker + título de uma linha "PB-MM.NN — Título". Retorna null se não
 * casar o padrão (aí o chamador usa o título puro).
 */
export function parseLessonTitle(
  line: string | null | undefined,
): LessonHeading | null {
  if (!line) return null
  const m = H1_PB.exec(line)
  if (!m) return null
  const modulo = Number(m[1])
  const nome = MODULE_TITLES[modulo]
  const mm = String(modulo).padStart(2, '0')
  return {
    kicker: nome ? `PB-${mm} · ${nome}` : `PB-${mm}`,
    titulo: m[3],
  }
}

/** Primeira linha não-vazia do markdown (candidata a h1), ou null. */
export function firstMarkdownLine(md: string | null | undefined): string | null {
  if (!md) return null
  for (const raw of md.split('\n')) {
    const line = raw.trim()
    if (line) return line
  }
  return null
}

/**
 * Remove o primeiro h1 (`# ...`) do markdown quando ele é o título da aula —
 * evita duplicar com o cabeçalho da página. Só remove se a 1ª linha não-vazia
 * for um h1; preserva o resto intacto.
 */
export function stripLeadingH1(md: string | null | undefined): string {
  if (!md) return ''
  const lines = md.split('\n')
  let i = 0
  while (i < lines.length && lines[i].trim() === '') i++
  if (i < lines.length && /^\s*#\s+/.test(lines[i])) {
    lines.splice(i, 1)
    if (i < lines.length && lines[i].trim() === '') lines.splice(i, 1)
  }
  return lines.join('\n').trim()
}

// Heading da seção de fontes/referências: "## N. Fontes" ou "## Referências".
// Exige que o TÍTULO comece com Fontes/Fonte/Referências (após o número) — assim
// não casa "## 3. Falas de referência" (conteúdo legítimo do módulo Scripts).
const SOURCES_HEADING = /^#{1,6}\s*(?:\d+\.\s*)?(?:Fontes?|Refer[êe]ncias)\b/i

/**
 * Remove a seção final de FONTES/REFERÊNCIAS das aulas (links de vídeo + KB que
 * o NotebookLM anexa). Corta do último heading de fontes até o fim, incluindo um
 * separador `---` imediatamente anterior. Se não houver, devolve o texto intacto.
 */
export function stripSourcesSection(md: string | null | undefined): string {
  if (!md) return ''
  const lines = md.split('\n')
  let cut = -1
  for (let i = 0; i < lines.length; i++) {
    if (SOURCES_HEADING.test(lines[i])) cut = i
  }
  if (cut === -1) return md.trim()
  // Recua sobre linhas em branco e um separador `---` antes do heading.
  let start = cut
  let j = cut - 1
  while (j >= 0 && lines[j].trim() === '') j--
  if (j >= 0 && /^-{3,}\s*$/.test(lines[j].trim())) start = j
  return lines.slice(0, start).join('\n').trim()
}
