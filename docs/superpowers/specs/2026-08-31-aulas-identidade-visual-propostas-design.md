# Aulas com a identidade visual das propostas — Design

**Data:** 2026-08-31
**Autor:** Diego + Claude
**Status:** aprovado (direção) — aguardando review do spec

## Problema

As aulas da Academy renderizam o `texto_md` como markdown "cru" em tema dark
básico (`LessonText.tsx`), com fontes de sistema. Diego quer que as aulas tenham
a **identidade visual das propostas comerciais** da ContrataPJ (deck HTML):
tipografia Outfit + Plus Jakarta Sans, títulos com destaque azul/coral, cards de
callout, checklists e tabelas estilizadas.

## Decisão de direção

**"Marca aplicada à leitura"** (não réplica dos slides light, nem redesenho
manual de cada aula). O conteúdo permanece markdown; **só o renderizador muda**.
Uma alteração em `LessonText.tsx` (+ fontes + cabeçalho da aula) estiliza as 184
aulas de uma vez, sem editar conteúdo.

Motivo: as 184 aulas têm estrutura consistente, o que permite mapear markdown →
componentes da proposta automaticamente.

## Realidade do conteúdo (inventário das 184 aulas)

Fonte: `Contrata PJ/Comercial/Playbooks/_NotebookLM-MD/**/PB-*.md`

| Elemento markdown | Cobertura | Vira |
|---|---|---|
| `# PB-02.01 — Título` | 184/184 | Kicker (`PB-02 · ABORDAGEM`) + título Outfit c/ destaque |
| 1º blockquote em **negrito** (regra de ouro) | 184/184 | Card de destaque (callout-assinatura) |
| `## N. Seção` numerada | 184/184 | Cabeçalho com número em badge azul |
| Task list `- [ ]` | 179/184 | Checklist com check custom coral |
| Tabelas | 140/184 | Tabela estilizada (header navy, hairlines, radius) |
| Code fence (scripts) | scripts | Card de script (monoespaçado, rótulo "Script") |
| Blockquote normal | vários | Aside em card de vidro discreto |

Não há GFM alerts (`> [!NOTE]`) no conteúdo — não dependemos deles.

## Identidade visual de referência (deck de propostas)

- **Fontes:** Outfit (títulos/kickers), Plus Jakarta Sans (corpo).
- **Cores (já são as do app):** navy `#1C265E`, royal/blue `#4259DF`,
  blue-bright `#6F83FF`, coral `#DE5968`, white `#F4F6FF`, bg `#0A0A0C`.
- **Motivos:** kicker uppercase com traço, título com destaque azul/coral,
  cards arredondados com sombra suave, badges numéricos, checks.

O app já tem o fundo "Blue Ocean" (`ocean-bg`) e painel de vidro (`ocean-glass`)
— a paleta já casa; falta a **tipografia** e os **componentes editoriais**.

## Escopo

**Dentro:**
1. **Fontes offline** — adicionar `@fontsource-variable/outfit` e
   `@fontsource-variable/plus-jakarta-sans` (v5.3.0), importados no bundle
   (PWA offline-safe). Expor no Tailwind como `font-display` (Outfit) e
   `font-sans` (Jakarta).
2. **`LessonText.tsx`** — reescrever o mapa de `components` do react-markdown
   para os 8 tratamentos acima. Manter a segurança atual (sem HTML cru; sem
   `dangerouslySetInnerHTML`).
3. **Cabeçalho da aula** (`LessonPage.tsx`) — o título vira kicker + título
   Outfit. Regra: se `lesson.titulo`/1ª linha casar `^PB-(\d+)\.(\d+)\s*—\s*(.+)$`,
   dividir em kicker `PB-0N · <MÓDULO>` + título `<resto>`. Senão, título puro.
4. **Regra de ouro** — o 1º blockquote da aula recebe tratamento de card de
   destaque (borda coral, ícone); blockquotes seguintes = aside de vidro.

**Fora (YAGNI):** vídeo, quiz, botões de conclusão, sidebar, blocos de
estatística (não há números deriváveis do markdown), edição de conteúdo,
Google Fonts via rede.

## Componentes / arquitetura

- `src/theme/fonts.ts` (novo) — importa os CSS do fontsource num único módulo,
  importado uma vez em `main.tsx`. Mantém o bundle de fontes isolado.
- `tailwind.config.ts` — `fontFamily.display = ['Outfit Variable', ...]`,
  `fontFamily.sans = ['Plus Jakarta Sans Variable', ...system]`.
- `LessonText.tsx` — continua presentational e puro; só cresce o mapa de estilos.
  Se ficar grande, extrair sub-componentes (`GoldenRule`, `ScriptCard`,
  `SectionHeading`) para o mesmo diretório `lesson/`.
- Helper `parseLessonTitle(raw): { kicker, titulo } | null` — puro, testável,
  em `lesson/` — usado pelo cabeçalho. Mapa ordem→nome do módulo reaproveitado
  de `scripts/seed-lessons.ts` (extrair para módulo compartilhado se necessário).

## "Regra de ouro" — como identificar o 1º blockquote

`react-markdown` não dá índice de ocorrência no `components.blockquote`. Decisão:
começar pela heurística (1º blockquote cujo 1º filho é `strong` → card de
destaque; demais → aside de vidro), evitando plugin remark. Reavaliar se falhar
em alguma aula.

## Acessibilidade

- Contraste de texto ≥ 4.5:1 sobre o fundo dark (mantido).
- Checks custom com `aria-hidden` no ícone; o texto do item carrega o significado.
- Fontes variáveis com `font-display: swap` (fallback system enquanto carrega).

## Testes

- `parseLessonTitle` — casos: com PB-NN.MM, sem match, traço unicode.
- `LessonText` — renderiza h1/h2/checklist/tabela/script/regra-de-ouro com as
  classes/estruturas esperadas (estende os testes atuais, não os quebra).
- `LessonPage` — cabeçalho mostra kicker quando o título casa o padrão.

## Rollout

- É mudança só de front-end (render). **Não** depende das capas nem de SQL.
- Deploy: build Vite + publish (mesmo fluxo do app). "Feito" só após deploy.
