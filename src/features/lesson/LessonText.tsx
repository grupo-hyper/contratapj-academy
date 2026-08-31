/**
 * LessonText — render do conteúdo em Markdown da aula, na identidade visual das
 * PROPOSTAS comerciais da ContrataPJ (tipografia Outfit/Jakarta + componentes
 * editoriais), sobre o tema dark "Blue Ocean".
 *
 * Usa `react-markdown` (+ `remark-gfm`). Continua SEGURO: sem `dangerouslySet-
 * InnerHTML` e sem HTML cru — por isso não sanitizamos `texto_md`.
 *
 * Mapa markdown → identidade (dirigido pelo conteúdo real das 184 aulas):
 *  - `## N. Seção`         → cabeçalho com número em badge azul
 *  - 1º blockquote negrito → "Regra de ouro" (card de destaque coral)
 *  - blockquote normal     → aside em card de vidro
 *  - task list `- [ ]`     → checklist com check coral (CSS em index.css)
 *  - tabela                → header navy + hairlines, cara de card
 *  - code fence            → card de "Script" (mono)
 */
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface LessonTextProps {
  markdown: string | null
}

/** Nó mínimo do hast que consumimos (react-markdown passa `node`). */
type HastNode = {
  type?: string
  tagName?: string
  value?: string
  children?: HastNode[]
}

/** Concatena o texto puro de um nó hast (para ler "1. Objetivo" num h2). */
function nodeText(n?: HastNode): string {
  if (!n) return ''
  if (typeof n.value === 'string') return n.value
  return (n.children ?? []).map(nodeText).join('')
}

/** true se o blockquote começa com **negrito** (nossa "regra de ouro"). */
function startsWithStrong(node?: HastNode): boolean {
  const firstEl = node?.children?.find((c) => c.type === 'element')
  const firstInner = firstEl?.children?.find((c) => c.type === 'element')
  return firstInner?.tagName === 'strong'
}

const components: Components = {
  h1: ({ node: _n, ...props }) => (
    <h1
      className="mt-8 mb-3 font-display text-2xl font-extrabold tracking-tight text-cpj-white first:mt-0"
      {...props}
    />
  ),
  h2: ({ node, children, ...props }) => {
    const m = /^\s*(\d+)\.\s*(.+)$/.exec(nodeText(node as HastNode))
    if (m) {
      return (
        <h2
          className="mt-9 mb-3 flex items-center gap-3 font-display text-xl font-bold text-cpj-white first:mt-0"
          {...props}
        >
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-cpj-royal/20 font-display text-sm font-extrabold text-cpj-royal">
            {m[1]}
          </span>
          {m[2]}
        </h2>
      )
    }
    return (
      <h2
        className="mt-9 mb-3 font-display text-xl font-bold text-cpj-white first:mt-0"
        {...props}
      >
        {children}
      </h2>
    )
  },
  h3: ({ node: _n, ...props }) => (
    <h3
      className="mt-6 mb-2 font-display text-lg font-semibold text-cpj-white first:mt-0"
      {...props}
    />
  ),
  p: ({ node: _n, ...props }) => (
    <p className="my-3 leading-relaxed text-cpj-white/90" {...props} />
  ),
  ul: ({ node: _n, className, ...props }) => (
    <ul
      className={`my-3 list-disc space-y-1.5 pl-6 marker:text-cpj-royal/70 ${className ?? ''}`}
      {...props}
    />
  ),
  ol: ({ node: _n, className, ...props }) => (
    <ol
      className={`my-3 list-decimal space-y-1.5 pl-6 marker:text-cpj-royal/70 ${className ?? ''}`}
      {...props}
    />
  ),
  li: ({ node: _n, className, ...props }) => (
    <li className={`leading-relaxed ${className ?? ''}`} {...props} />
  ),
  a: ({ node: _n, ...props }) => (
    <a
      className="text-cpj-coral underline underline-offset-2 hover:text-cpj-coral/80"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  strong: ({ node: _n, ...props }) => (
    <strong className="font-semibold text-cpj-white" {...props} />
  ),
  em: ({ node: _n, ...props }) => (
    <em className="italic text-cpj-white/90" {...props} />
  ),
  blockquote: ({ node, children }) => {
    if (startsWithStrong(node as HastNode)) {
      return (
        <div className="my-5 rounded-2xl border border-cpj-coral/40 border-l-4 border-l-cpj-coral bg-cpj-coral/5 p-4 sm:p-5">
          <p className="mb-1.5 flex items-center gap-2 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-cpj-coral">
            <span aria-hidden>★</span> Regra de ouro
          </p>
          <div className="text-cpj-white/90 [&>p]:my-0 [&>p+p]:mt-2">
            {children}
          </div>
        </div>
      )
    }
    return (
      <blockquote className="ocean-glass my-4 rounded-xl border-l-4 border-l-cpj-royal/60 p-4 text-cpj-white/80 [&>p]:my-0 [&>p+p]:mt-2">
        {children}
      </blockquote>
    )
  },
  code: ({ node: _n, className, children, ...props }) => {
    const text = String(children ?? '')
    const isBlock = text.includes('\n') || /language-/.test(className ?? '')
    if (isBlock) {
      return (
        <span className="my-4 block">
          <span className="mb-1 block font-display text-[11px] font-bold uppercase tracking-[0.14em] text-cpj-royal">
            Script
          </span>
          <code className="block overflow-x-auto whitespace-pre-wrap rounded-xl border border-cpj-white/10 bg-cpj-navy/50 p-4 font-mono text-sm leading-relaxed text-cpj-white">
            {children}
          </code>
        </span>
      )
    }
    return (
      <code
        className="rounded bg-cpj-navy/60 px-1.5 py-0.5 font-mono text-[0.85em] text-cpj-white"
        {...props}
      >
        {children}
      </code>
    )
  },
  // O bloco de código já é estilizado no `code`; `pre` não adiciona wrapper.
  pre: ({ children }) => <>{children}</>,
  table: ({ node: _n, ...props }) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-cpj-white/10">
      <table className="w-full border-collapse text-left text-sm" {...props} />
    </div>
  ),
  thead: ({ node: _n, ...props }) => (
    <thead className="bg-cpj-navy/50" {...props} />
  ),
  th: ({ node: _n, ...props }) => (
    <th
      className="border-b border-cpj-white/15 px-3 py-2 font-display font-semibold text-cpj-white"
      {...props}
    />
  ),
  td: ({ node: _n, ...props }) => (
    <td
      className="border-b border-cpj-white/10 px-3 py-2 align-top text-cpj-white/80"
      {...props}
    />
  ),
  hr: ({ node: _n }) => (
    <hr className="my-8 h-px border-0 bg-gradient-to-r from-transparent via-cpj-white/15 to-transparent" />
  ),
}

export function LessonText({ markdown }: LessonTextProps) {
  if (!markdown || markdown.trim() === '') {
    return (
      <p className="text-sm text-cpj-white/60">
        Esta aula ainda não tem material em texto.
      </p>
    )
  }

  return (
    <div className="lesson-prose max-w-none font-sans text-cpj-white/90">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
