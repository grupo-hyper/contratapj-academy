/**
 * LessonText — render do conteúdo em Markdown da aula (Task 3.3). Presentational.
 *
 * Usa `react-markdown` (+ `remark-gfm` para tabelas/checklists/strikethrough do
 * GFM). O react-markdown é seguro por padrão: NÃO usa dangerouslySetInnerHTML e
 * NÃO renderiza HTML cru — por isso não precisamos sanitizar `texto_md`.
 *
 * Não há `@tailwindcss/typography` no projeto (decisão de escopo): estilizamos
 * os elementos comuns manualmente via `components` para ficarem legíveis no tema
 * dark (`bg-cpj-bg`). Trata null/vazio graciosamente.
 */
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface LessonTextProps {
  markdown: string | null
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
    <div className="max-w-none text-cpj-white/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ ...props }) => (
            <h1
              className="mt-8 mb-3 text-2xl font-bold text-cpj-white first:mt-0"
              {...props}
            />
          ),
          h2: ({ ...props }) => (
            <h2
              className="mt-7 mb-2 text-xl font-bold text-cpj-white first:mt-0"
              {...props}
            />
          ),
          h3: ({ ...props }) => (
            <h3
              className="mt-6 mb-2 text-lg font-semibold text-cpj-white first:mt-0"
              {...props}
            />
          ),
          p: ({ ...props }) => (
            <p className="my-3 leading-relaxed text-cpj-white/90" {...props} />
          ),
          ul: ({ ...props }) => (
            <ul className="my-3 list-disc space-y-1 pl-6" {...props} />
          ),
          ol: ({ ...props }) => (
            <ol className="my-3 list-decimal space-y-1 pl-6" {...props} />
          ),
          li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
          a: ({ ...props }) => (
            <a
              className="text-cpj-coral underline underline-offset-2 hover:text-cpj-coral/80"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          strong: ({ ...props }) => (
            <strong className="font-semibold text-cpj-white" {...props} />
          ),
          blockquote: ({ ...props }) => (
            <blockquote
              className="my-4 border-l-4 border-cpj-royal/60 pl-4 italic text-cpj-white/70"
              {...props}
            />
          ),
          code: ({ ...props }) => (
            <code
              className="rounded bg-cpj-navy/60 px-1.5 py-0.5 font-mono text-sm text-cpj-white"
              {...props}
            />
          ),
          pre: ({ ...props }) => (
            <pre
              className="my-4 overflow-x-auto rounded-xl bg-cpj-navy/60 p-4 text-sm text-cpj-white"
              {...props}
            />
          ),
          table: ({ ...props }) => (
            <div className="my-4 overflow-x-auto">
              <table
                className="w-full border-collapse text-left text-sm"
                {...props}
              />
            </div>
          ),
          th: ({ ...props }) => (
            <th
              className="border-b border-cpj-white/20 px-3 py-2 font-semibold text-cpj-white"
              {...props}
            />
          ),
          td: ({ ...props }) => (
            <td
              className="border-b border-cpj-white/10 px-3 py-2 text-cpj-white/80"
              {...props}
            />
          ),
          hr: ({ ...props }) => (
            <hr className="my-6 border-cpj-white/10" {...props} />
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
