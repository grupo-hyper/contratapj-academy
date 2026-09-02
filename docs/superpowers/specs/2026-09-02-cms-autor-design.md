# CMS do Autor — Painel de edição de conteúdo — Design

**Data:** 2026-09-02
**Autor:** Diego + Claude
**Status:** aguardando review do spec

## Problema

A rota `/autor` (restrita ao papel `autor` + admins) é hoje um stub (`AutorStub`).
O autor precisa de um painel para **gerenciar o conteúdo** da Academy sem mexer
em SQL: editar o texto/vídeo das aulas, criar/reordenar/publicar módulos e aulas,
e manter o quiz de cada módulo (perguntas, alternativas e gabarito).

## Contexto que já existe (não precisa criar)

- **RLS pronta:** o papel `autor` já tem policies de **INSERT/UPDATE/DELETE** em
  `modules`, `lessons`, `questions`, `question_options`
  (`supabase/migrations/0002_content.sql`). **Não há migration nova** — o CMS é
  UI de CRUD com o client Supabase autenticado.
- **Render de conteúdo:** `LessonSlides` + `lessonMarkdown` (identidade das
  propostas, fatiamento por `## N.`) — reaproveitados no preview do editor.
- **Padrões:** react-query (`useLesson`, `useHomeData`), mutations com
  invalidação de query, tema dark "Blue Ocean", `AppLayout` (sidebar + Outlet),
  `RequireRole allow={['autor']}` já protege `/autor`.
- **Tipos:** `src/types/content.ts` espelha o schema (Module, Lesson, Question,
  QuestionOption).

## Modelo de dados (relevante)

- `modules(id, ordem 1..12 unique, titulo, descricao, capa_url, publicado, created_at)`
- `lessons(id, module_id→modules, ordem, titulo, texto_md, youtube_id, duracao_seg, publicado, created_at)` — `unique(module_id, ordem)`
- `questions(id, module_id→modules, enunciado, created_at)`
- `question_options(id, question_id→questions, texto, correta, created_at)`

`correta` (gabarito) só é legível pelo autor via RLS — ok expor no CMS.

## Decisões (validadas no brainstorming)

1. **Layout:** master–detail em 2 painéis em `/autor`. Esquerda = árvore
   Módulos ▸ Aulas (+ item "Quiz do módulo"). Direita = editor do item
   selecionado. Sem recarregar a página.
2. **Editor de aula:** Markdown à esquerda, **preview em SLIDES** à direita
   (WYSIWYG real = `LessonSlides`, porém com navegação livre, **sem** o gate de
   5s). Campos: título, YouTube ID; ações: Salvar, alternar Rascunho/Publicado.
3. **Salvamento:** **botão Salvar** manual; avisar sobre "alterações não salvas"
   ao trocar de item/sair. Sem autosave.
4. **Reordenar:** **setas ↑↓** por item (troca de posição com o vizinho). Vale
   para aulas dentro do módulo e para módulos.
5. **Capa do módulo:** **campo de URL** (`capa_url`). Sem upload no v1.
6. **Faseamento:** 3 incrementos, cada um deployado antes do próximo.

## Arquitetura

Nova feature em `src/features/authoring/` (nome em inglês seguindo o padrão de
`features/`). Estrutura por fase abaixo. Tudo client-side sobre o client
Supabase; sem edge functions.

Convenção de dados: um hook de leitura + hooks de mutation por entidade, todos
com react-query e invalidação. Ex.: `useAuthorTree` (módulos+aulas), `useSaveLesson`,
`useCreateLesson`, `useReorder`, `useModule`, `useQuiz`. Componentes de tela
pequenos e focados (árvore, editor, painel de módulo, editor de quiz).

### Reordenação e a constraint `unique(module_id, ordem)`

Trocar duas posições viola o unique se feito em dois UPDATEs ingênuos. Decisão:
fazer o swap em **passo triplo** (mover A para `ordem` temporária negativa/alta,
mover B para a de A, mover A para a de B) OU via uma pequena RPC transacional se
o passo triplo se mostrar frágil. Detalhe a resolver no plano; a UI é só ↑↓.

## Fases

### F1 — Editor de aula (fundação)
- Tela `/autor` com master-detail; a árvore lista módulos e aulas (leitura).
- Selecionar uma aula abre o editor: título, YouTube ID, textarea de `texto_md`,
  **preview em slides** (LessonSlides navegável), botão **Salvar** (UPDATE em
  `lessons`), toggle **Publicado/Rascunho**. Aviso de alterações não salvas.
- Sem criar/excluir/reordenar ainda. Substitui `AutorStub` na rota.

### F2 — Gestão de módulos e aulas
- Criar/editar/excluir **módulos** (título, descrição, `capa_url`, ordem 1..12,
  publicado) e **aulas** (criar dentro do módulo, excluir).
- **Reordenar** aulas e módulos com ↑↓ (swap seguro).
- Confirmação em exclusões (cascata: excluir módulo remove aulas/quiz).

### F3 — Quiz do módulo
- Item "Quiz do módulo" na árvore abre o editor de quiz: lista de perguntas
  (`enunciado`) e, por pergunta, as `question_options` (texto + marcar a
  **correta**). Criar/editar/excluir perguntas e alternativas.
- Regra mínima de sanidade na UI: cada pergunta deve ter ≥2 alternativas e
  exatamente 1 correta (aviso, não bloqueio rígido no banco).

## Tratamento de erros

- Toda mutation trata falha (RLS/rede) mostrando mensagem inline e mantendo o
  formulário editável para retry (padrão do `markConcluded`).
- Estados de loading/skeleton reaproveitando o padrão existente.
- Guardas: se um usuário sem papel `autor` chegar (não deveria, `RequireRole`
  cobre), as queries retornam vazio por RLS — a UI mostra "sem acesso".

## Testes

- Helpers puros (ex.: swap de ordem, validação do quiz) com testes unitários.
- Componentes com Testing Library: árvore seleciona item; editor salva e mostra
  erro; toggle publicar; preview em slides renderiza; quiz marca correta.
- Seguir a cultura do repo (cada unidade com seu `.test`).

## Fora de escopo (YAGNI)

- Upload de imagens (capa por URL), autosave, drag-and-drop, versionamento/
  histórico de edições, colaboração multi-autor em tempo real, edição em massa,
  markdown toolbar rica (textarea simples basta).

## Rollout

- Só front-end; **sem migrations**. Deploy pelo fluxo atual (push na `main` →
  GitHub Pages). "Feito" só após deploy, por fase.
