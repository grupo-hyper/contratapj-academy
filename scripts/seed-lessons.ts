/**
 * Seed dos 184 playbooks (ContrataPJ Academy).
 *
 * Lê os arquivos Markdown de `<NN-Modulo>/NN.MM-slug-do-titulo.md` (série
 * oficial revisada, com frontmatter YAML + h1 `# PB-MM.NN - Título`), monta 12
 * módulos (ordem/nome fixos) e 184 aulas, e faz upsert idempotente (módulos por
 * `ordem`, aulas por `module_id + ordem`). O frontmatter é removido do
 * `texto_md` gravado; o título da aula vem do h1, não do nome do arquivo.
 *
 * Uso:
 *   PLAYBOOKS_DIR="/caminho/Playbooks" \
 *   SUPABASE_URL="https://xxxx.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="..." \
 *   npx tsx --import ./wspoly.mjs scripts/seed-lessons.ts   # aplica no banco
 *   (--import ./wspoly.mjs: polyfill de WebSocket p/ Node 20, exigido pelo
 *   client do Supabase mesmo em scripts que só fazem upsert via REST)
 *
 *   npx tsx scripts/seed-lessons.ts --dry-run  # só conta, não grava (não precisa do polyfill)
 *
 * A parte de leitura/parse (`collectSeed`) é pura e sem I/O de rede, para o teste.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Caminho-fonte padrão (vault do Diego); sobrescreva via PLAYBOOKS_DIR. */
export const DEFAULT_PLAYBOOKS_DIR =
  '/home/diego/segundo-cerebro/Empresas/Contrata PJ/Comercial/Playbooks'

/** Nomes oficiais dos 12 módulos, indexados pela ordem (1..12). */
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

export interface SeedModule {
  ordem: number
  titulo: string
}

export interface SeedLesson {
  module_ordem: number
  ordem: number
  titulo: string
  texto_md: string
  youtube_id: string
}

export interface SeedData {
  modules: SeedModule[]
  lessons: SeedLesson[]
}

/** Extrai a ordem do módulo do nome da pasta `NN-Nome` (ex.: `03-Diagnostico` → 3). */
export function parseModuleOrdem(folderName: string): number | null {
  const m = /^(\d{1,2})\b/.exec(folderName)
  if (!m) return null
  const n = Number(m[1])
  return n >= 1 && n <= 12 ? n : null
}

/**
 * Extrai a ordem da aula de um nome de arquivo `NN.MM-slug-do-titulo.md`
 * (ex.: `05.03-tecnicas-de-reformulacao.md` → 3). O título NÃO vem mais do
 * nome do arquivo (é um slug); vem do h1 do conteúdo (`extractTitleFromH1`).
 */
export function parseLessonFile(fileName: string): { ordem: number } | null {
  const base = fileName.replace(/\.md$/i, '')
  const m = /^\d{1,2}\.(\d{1,3})-.+$/.exec(base)
  if (!m) return null
  const ordem = Number(m[1])
  return Number.isFinite(ordem) ? { ordem } : null
}

// Bloco de frontmatter YAML no início do arquivo: `---\n...\n---` + linha em branco.
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/

/** Remove o bloco de frontmatter YAML do início do conteúdo, se houver. */
export function stripFrontmatter(content: string): string {
  return content.replace(FRONTMATTER, '').replace(/^\s+/, '')
}

// `# PB-MM.NN - Título` (aceita travessão "—", en dash "–" ou hífen "-") — mesmo
// padrão que o client espera em `src/features/lesson/lessonTitle.ts`.
const H1_TITLE = /^#\s*PB-\d{1,2}\.\d{1,3}\s*[—–-]\s*(.+?)\s*$/

/** Extrai o título do 1º h1 `# PB-MM.NN - Título` do corpo (após remover frontmatter). */
export function extractTitleFromH1(body: string): string | null {
  const firstLine = body.split('\n').find((l) => l.trim() !== '')
  if (!firstLine) return null
  const m = H1_TITLE.exec(firstLine.trim())
  return m ? m[1] : null
}

/**
 * Lê o diretório e monta os módulos/aulas (puro quanto a rede; só lê disco).
 * Lança se encontrar um arquivo/pasta fora do padrão, para não seedar lixo.
 */
export function collectSeed(dir: string = DEFAULT_PLAYBOOKS_DIR): SeedData {
  const modules: SeedModule[] = []
  const lessons: SeedLesson[] = []

  const folders = readdirSync(dir)
    .filter((name) => {
      try {
        return statSync(join(dir, name)).isDirectory()
      } catch {
        return false
      }
    })
    .sort()

  for (const folder of folders) {
    // Pastas auxiliares (ex.: `_NotebookLM-MD`, fonte bruta anterior) não são módulos.
    if (folder.startsWith('_')) continue

    const ordem = parseModuleOrdem(folder)
    if (ordem == null) {
      throw new Error(`Pasta de módulo fora do padrão "NN-Nome": ${folder}`)
    }
    const titulo = MODULE_TITLES[ordem] ?? folder.replace(/^\d{1,2}[-_]?/, '')
    modules.push({ ordem, titulo })

    const files = readdirSync(join(dir, folder))
      .filter((f) => f.toLowerCase().endsWith('.md'))
      .sort()

    for (const file of files) {
      const parsed = parseLessonFile(file)
      if (!parsed) {
        throw new Error(`Arquivo de aula fora do padrão "NN.MM-slug.md": ${folder}/${file}`)
      }
      const raw = readFileSync(join(dir, folder, file), 'utf8')
      const texto_md = stripFrontmatter(raw)
      const titulo = extractTitleFromH1(texto_md)
      if (!titulo) {
        throw new Error(`Não encontrei o h1 "# PB-MM.NN - Título" em: ${folder}/${file}`)
      }
      lessons.push({
        module_ordem: ordem,
        ordem: parsed.ordem,
        titulo,
        texto_md,
        youtube_id: '',
      })
    }
  }

  modules.sort((a, b) => a.ordem - b.ordem)
  return { modules, lessons }
}

/** Executa o seed contra o Supabase usando service_role (bypassa RLS). */
async function main(): Promise<void> {
  const dir = process.env.PLAYBOOKS_DIR ?? DEFAULT_PLAYBOOKS_DIR
  const dryRun = process.argv.includes('--dry-run')

  const data = collectSeed(dir)
  console.log(`Lidos ${data.modules.length} módulos e ${data.lessons.length} aulas de ${dir}`)

  if (dryRun) {
    console.log('--dry-run: nada gravado.')
    return
  }

  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para gravar (ou use --dry-run).',
    )
  }

  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(url, serviceKey, { auth: { persistSession: false } })

  // 1) upsert módulos (por ordem) e mapeia ordem -> id
  const { data: mods, error: mErr } = await db
    .from('modules')
    .upsert(
      data.modules.map((m) => ({ ordem: m.ordem, titulo: m.titulo, publicado: true })),
      { onConflict: 'ordem' },
    )
    .select('id, ordem')
  if (mErr) throw mErr
  const idByOrdem = new Map<number, string>((mods ?? []).map((m) => [m.ordem, m.id]))

  // 2) upsert aulas (por module_id + ordem). NÃO envia `youtube_id`/`publicado`:
  // são campos que o CMS do autor edita direto no banco (LessonEditor.tsx); como
  // o upsert do Supabase só atualiza as colunas presentes no payload, omiti-los
  // preserva o vídeo e o estado rascunho/publicado já definidos pelo autor em
  // aulas existentes (só título e texto são atualizados pelo re-seed).
  const rows = data.lessons.map((l) => ({
    module_id: idByOrdem.get(l.module_ordem),
    ordem: l.ordem,
    titulo: l.titulo,
    texto_md: l.texto_md,
  }))
  const { error: lErr } = await db.from('lessons').upsert(rows, { onConflict: 'module_id,ordem' })
  if (lErr) throw lErr

  console.log(`Seed concluído: ${data.modules.length} módulos, ${data.lessons.length} aulas.`)
}

// Só executa quando rodado diretamente (não ao ser importado pelo teste).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
