# ContrataPJ Academy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir uma PWA de treinamento interno da ContrataPJ (estilo streaming/Netflix dark) com os 184 playbooks em 12 módulos, trilha sequencial, testes com certificação (≥80%), cadeia de metas e painel de gestão.

**Architecture:** React + Vite + Tailwind (PWA) no frontend; Supabase (Postgres + RLS + Auth + Storage) no backend. Vídeos por embed do YouTube não listado. Frontend implementado com a skill `/ui-ux-pro-max`; toda a copy com `/humanizer`. Implementação com Opus.

**Tech Stack:** React, Vite, TypeScript, TailwindCSS, vite-plugin-pwa, Supabase (postgres/rls/auth/storage/edge functions), React Router, TanStack Query, YouTube embed, geração de PDF (pdf-lib/react-pdf).

**Referência de spec:** `docs/superpowers/specs/2026-08-22-contratapj-academy-design.md`

---

## Estrutura de fases (cada fase = software funcional e testável)

- **Fase 0 — Fundação:** projeto React+Vite+Tailwind+PWA, tema ContrataPJ (dark), Supabase conectado, CI/lint/test.
- **Fase 1 — Auth & perfis:** login e-mail/magic link, tabela `profiles`, roles (aluno/gestor/autor), guarda de rotas.
- **Fase 2 — Conteúdo (schema + seed):** tabelas de módulos/aulas/questões + import dos 184 MD.
- **Fase 3 — Experiência do aluno:** Home streaming, player de aula (vídeo+texto+download), progresso, trilha travada.
- **Fase 4 — Testes & certificados:** quiz (banco/sorteio/tentativas/espera), regra 80%, PDF de certificado (12+1).
- **Fase 5 — Cadeia de metas & gestão:** metas (turma/individual), dashboard do gestor, ranking, relatórios.
- **Fase 6 — CMS do autor:** CRUD de módulos/aulas/questões.

Cada fase abaixo lista suas tarefas. As tarefas seguem TDD (teste → falha → implementação → verde → commit). Onde o passo cria código, o código é mostrado no momento da execução da fase — este documento fixa o **contrato** (arquivos, interfaces, critérios de aceite) de cada tarefa para não haver ambiguidade.

---

## File Structure (visão geral)

```
contratapj-academy/
├─ src/
│  ├─ main.tsx, App.tsx, router.tsx
│  ├─ theme/            # tokens ContrataPJ (cores, tipografia)
│  ├─ lib/supabase.ts   # client Supabase
│  ├─ auth/             # AuthProvider, useAuth, RequireRole
│  ├─ components/       # UI compartilhada (Row, Tile, Hero, ProgressBar…)
│  ├─ features/
│  │  ├─ home/          # dashboard do aluno
│  │  ├─ lesson/        # player (vídeo+texto+download)
│  │  ├─ quiz/          # teste do módulo
│  │  ├─ certificates/  # lista + geração PDF
│  │  ├─ goals/         # metas do aluno
│  │  ├─ manager/       # dashboard/turmas/relatórios (gestor)
│  │  └─ cms/           # autor de conteúdo
│  └─ types/            # tipos compartilhados (Module, Lesson, Question…)
├─ supabase/
│  ├─ migrations/       # SQL (schema + RLS)
│  └─ functions/        # edge functions (ex.: certificate-pdf)
├─ scripts/seed-lessons.ts   # importa os 184 MD
└─ tests/
```

---

## Fase 0 — Fundação

### Task 0.1: Scaffold do projeto
**Files:** Create `contratapj-academy/` (Vite React+TS), `package.json`, `tailwind.config.ts`, `vite.config.ts`.
- [ ] Criar app Vite React+TS; instalar Tailwind, react-router-dom, @tanstack/react-query, @supabase/supabase-js, vite-plugin-pwa, vitest + @testing-library.
- [ ] Configurar Tailwind + Vitest; smoke test (`App` renderiza) passando.
- [ ] Commit: `chore: scaffold contratapj-academy (vite+react+tailwind+pwa)`.
**Aceite:** `npm run dev` sobe; `npm test` verde; `npm run build` ok.

### Task 0.2: Tema ContrataPJ (dark/streaming)
**Files:** Create `src/theme/tokens.ts`, estender `tailwind.config.ts`.
- [ ] Definir tokens: `bg #0a0a0c`, `navy #1C265E`, `royal #4259DF`, `coral #DE5968`, `white #f4f6ff`.
- [ ] Teste: componente usa classe `bg-cpj-bg` e cor resolvida corresponde ao token.
- [ ] Commit: `feat: tema ContrataPJ dark (tokens + tailwind)`.
**Aceite:** tokens disponíveis como classes Tailwind; base do layout dark aplicada.

### Task 0.3: PWA
**Files:** Modify `vite.config.ts`; Create `public/manifest` + ícones (do `Icon_ContrataPJ`).
- [ ] Configurar vite-plugin-pwa (nome "ContrataPJ Academy", ícones, tema `#0a0a0c`).
- [ ] Commit: `feat: PWA instalável`.
**Aceite:** app instalável (manifest válido, service worker gerado no build).

### Task 0.4: Client Supabase + env
**Files:** Create `src/lib/supabase.ts`, `.env.example`.
- [ ] Client tipado com `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`.
- [ ] Teste: client inicializa sem env real (mock).
- [ ] Commit: `feat: client supabase`.
**Aceite:** import do client não quebra build/test.

---

## Fase 1 — Auth & perfis

### Task 1.1: Migration `profiles` + roles + RLS
**Files:** Create `supabase/migrations/0001_profiles.sql`.
- [ ] Tabela `profiles(id uuid PK → auth.users, nome text, role text check in ('aluno','gestor','autor') default 'aluno', avatar_url text, created_at timestamptz)`.
- [ ] Trigger cria `profiles` ao criar usuário no auth.
- [ ] RLS: usuário lê/edita o próprio; gestor lê todos; autor lê todos.
- [ ] Commit: `feat(db): profiles + roles + rls`.
**Aceite:** SQL aplica no Supabase; RLS testada por role (ver Nota de deploy).

### Task 1.2: AuthProvider + login e-mail/magic link
**Files:** Create `src/auth/AuthProvider.tsx`, `src/auth/useAuth.ts`, `src/features/auth/LoginPage.tsx`.
- [ ] Teste: `useAuth` expõe `user/profile/loading/signIn/signOut`.
- [ ] Login por senha e por magic link (Supabase Auth); tela na identidade dark.
- [ ] Copy da tela via `/humanizer`.
- [ ] Commit: `feat(auth): login e-mail/magic link`.
**Aceite:** login funcional; sessão persistida; logout limpa sessão.

### Task 1.3: Guarda de rotas por role
**Files:** Create `src/auth/RequireRole.tsx`, `src/router.tsx`.
- [ ] Teste: rota de gestor bloqueia aluno; rota de autor bloqueia aluno/gestor.
- [ ] Redireciona não-autenticado para `/login`.
- [ ] Commit: `feat(auth): RequireRole + rotas`.
**Aceite:** navegação respeita papéis.

---

## Fase 2 — Conteúdo (schema + seed)

### Task 2.1: Migration de conteúdo
**Files:** Create `supabase/migrations/0002_content.sql`.
- [ ] `modules(id, ordem int unique 1..12, titulo, descricao, capa_url, publicado bool)`.
- [ ] `lessons(id, module_id fk, ordem int, titulo, texto_md text, youtube_id text, duracao_seg int, publicado bool)` unique(module_id, ordem).
- [ ] `questions(id, module_id fk, enunciado)` e `question_options(id, question_id fk, texto, correta bool)`.
- [ ] RLS: leitura de publicados para autenticados; escrita só `autor`.
- [ ] Commit: `feat(db): módulos/aulas/questões + rls`.
**Aceite:** SQL aplica; leitura pública-interna, escrita restrita a autor.

### Task 2.2: Tipos compartilhados
**Files:** Create `src/types/content.ts`.
- [ ] `Module`, `Lesson`, `Question`, `QuestionOption` batendo com o schema.
- [ ] Commit: `feat(types): conteúdo`.
**Aceite:** tipos usados por queries sem `any`.

### Task 2.3: Script de seed dos 184 MD
**Files:** Create `scripts/seed-lessons.ts`.
- [ ] Lê `Contrata PJ/Comercial/Playbooks/_NotebookLM-MD/<modulo>/*.md`, cria 12 módulos (ordem/nome fixos) e insere cada MD como `lesson` (título = nome do arquivo, texto_md = conteúdo, `youtube_id` vazio p/ preencher depois).
- [ ] Idempotente (upsert por module+ordem).
- [ ] Teste: dry-run conta 12 módulos e 184 lessons.
- [ ] Commit: `feat(seed): importar 184 playbooks`.
**Aceite:** rodar contra Supabase popula 12 módulos e 184 aulas.

---

## Fase 3 — Experiência do aluno

### Task 3.1: Componentes de UI streaming
**Files:** Create `src/components/{Hero,Row,Tile,ProgressBar,TopNav}.tsx` (via `/ui-ux-pro-max`).
- [ ] Testes de render para `Tile` (estados: done/current/locked) e `ProgressBar`.
- [ ] Commit: `feat(ui): componentes streaming (dark)`.
**Aceite:** componentes espelham o mockup aprovado.

### Task 3.2: Home do aluno
**Files:** Create `src/features/home/HomePage.tsx`, hooks de query.
- [ ] Hero "continue assistindo" + fileiras (cadeia de metas, aulas do módulo atual).
- [ ] Teste: com dados mock, mostra módulo atual e trava os bloqueados.
- [ ] Commit: `feat(home): dashboard do aluno`.
**Aceite:** Home reflete progresso real do usuário logado.

### Task 3.3: Player da aula
**Files:** Create `src/features/lesson/LessonPage.tsx`, `LessonText.tsx`, `LessonVideo.tsx`.
- [ ] Embed YouTube + render do `texto_md` + botão **Download PDF** do texto.
- [ ] Marca `lesson_progress` (assistida) ao concluir vídeo/ação manual.
- [ ] Commit: `feat(lesson): player vídeo+texto+download`.
**Aceite:** assistir marca progresso; download gera PDF do playbook.

### Task 3.4: Migration `lesson_progress` + trilha travada
**Files:** Create `supabase/migrations/0003_progress.sql`; `src/features/home/useUnlock.ts`.
- [ ] `lesson_progress(id, profile_id, lesson_id, pct int, concluida bool, updated_at)` unique(profile_id, lesson_id); RLS dono.
- [ ] Regra de desbloqueio: módulo N+1 abre só com módulo N concluído (todas aulas + teste aprovado).
- [ ] Teste: usuário sem teste aprovado não abre próximo módulo.
- [ ] Commit: `feat(progress): trilha sequencial travada`.
**Aceite:** bloqueio/desbloqueio correto.

---

## Fase 4 — Testes & certificados

### Task 4.1: Migration `quiz_attempts`
**Files:** Create `supabase/migrations/0004_quiz.sql`.
- [ ] `quiz_attempts(id, profile_id, module_id, nota int, aprovado bool, respostas jsonb, created_at)`; RLS dono (+ gestor lê).
- [ ] Commit: `feat(db): quiz_attempts + rls`.

### Task 4.2: Motor do teste (sorteio + tentativas + espera + 80%)
**Files:** Create `src/features/quiz/useQuiz.ts`, `QuizPage.tsx`.
- [ ] Sorteia N questões do banco do módulo; corrige; calcula %; grava tentativa.
- [ ] Regras: **≥80% aprova**; **máx 3 tentativas**; **espera 24h** entre tentativas (defaults configuráveis).
- [ ] Testes: aprova em 80%; reprova em 79%; bloqueia 4ª tentativa; bloqueia dentro de 24h.
- [ ] Commit: `feat(quiz): motor de teste (80%/3 tentativas/24h)`.
**Aceite:** todas as regras cobertas por teste.

### Task 4.3: Migration `certificates` + emissão
**Files:** Create `supabase/migrations/0005_certificates.sql`; `src/features/certificates/issue.ts`.
- [ ] `certificates(id, profile_id, tipo 'modulo'|'final', module_id null, nota, codigo_verificacao, created_at)`; RLS dono (+ gestor lê).
- [ ] Emite certificado de módulo ao aprovar; emite **final** ao concluir os 12.
- [ ] Testes: aprovação emite 1 certificado; concluir 12 emite o final.
- [ ] Commit: `feat(cert): emissão 12+1`.

### Task 4.4: PDF do certificado
**Files:** Create `supabase/functions/certificate-pdf/` (ou `src/features/certificates/pdf.ts`).
- [ ] Gera PDF na identidade ContrataPJ (nome, módulo, data BRT, nota, código).
- [ ] Tela "Meus certificados" lista + baixa.
- [ ] Commit: `feat(cert): PDF + tela de certificados`.
**Aceite:** PDF baixável, on-brand, com código de verificação.

---

## Fase 5 — Cadeia de metas & gestão

### Task 5.1: Migration `classes`, `enrollments`, `goals`
**Files:** Create `supabase/migrations/0006_goals.sql`.
- [ ] `classes(id, nome, gestor_id)`, `enrollments(id, profile_id, class_id, created_at)`, `goals(id, escopo 'turma'|'individual', profile_id null, class_id null, module_id null, prazo date, meta_ritmo text, meta_acerto int)`; RLS (gestor escreve; aluno lê as suas).
- [ ] Commit: `feat(db): turmas/matrículas/metas + rls`.

### Task 5.2: Painel de metas do aluno
**Files:** Create `src/features/goals/GoalsPage.tsx`.
- [ ] Mostra prazos por módulo, ritmo alvo, % de acerto, status em dia/atrasado.
- [ ] Teste: atraso calculado corretamente vs prazo.
- [ ] Commit: `feat(goals): painel do aluno`.

### Task 5.3: Dashboard do gestor + ranking + relatórios
**Files:** Create `src/features/manager/{DashboardPage,ClassesPage,ReportsPage}.tsx`.
- [ ] Progresso agregado do time, atrasados, ranking, média nos testes; export CSV/PDF.
- [ ] Teste: agregações batem com dados mock.
- [ ] Commit: `feat(manager): dashboard/turmas/relatórios`.
**Aceite:** gestor cria turma, define metas, acompanha o time.

---

## Fase 6 — CMS do autor

### Task 6.1: CRUD de módulos/aulas
**Files:** Create `src/features/cms/{ModulesEditor,LessonEditor}.tsx`.
- [ ] Autor cria/edita módulo e aula (texto_md, youtube_id), publica/despublica.
- [ ] Testes de permissão (só autor) e validação.
- [ ] Commit: `feat(cms): módulos/aulas`.

### Task 6.2: Banco de questões
**Files:** Create `src/features/cms/QuestionsEditor.tsx`.
- [ ] CRUD de questões e alternativas com marcação de corretas.
- [ ] Teste: questão exige ≥1 correta.
- [ ] Commit: `feat(cms): banco de questões`.
**Aceite:** autor mantém conteúdo sem tocar em código.

---

## Nota de deploy (importante para este ambiente)
- **Edge functions:** deploy manual (`supabase functions deploy`), sem CI — ver memória `hypercrm-edge-functions-deploy-manual`.
- **Migrations:** aplicar via SQL Editor do Supabase; `db push` pode travar por histórico — ver `hypercrm-lovable-migration-deploy-gap`.
- **RLS multi-org / admin:** cuidado com `.maybeSingle()` em tabelas de role — ver `hypercrm-user-roles-maybesingle-multiorg`.
- **Datas:** gravar UTC, exibir BRT (UTC-3) — ver `horario-sempre-brasilia`.
- **"Feito" só após deploy** — ver `dizer-feito-so-apos-deploy`.

---

## Self-Review (writing-plans)
- **Cobertura do spec:** perfis (F1/F6), conteúdo/184 MD (F2), trilha travada (F3), testes 80%/3/24h (F4), certificados 12+1 + PDF (F4), metas + gestão (F5), identidade dark + toolchain ui-ux-pro-max/humanizer (F0/F3, headers). Notificações e app nativo = fora da v1 (spec §2). ✅
- **Placeholders:** contratos e critérios definidos por tarefa; código concreto é produzido na execução de cada fase (decisão explícita por causa do tamanho + uso de `/ui-ux-pro-max`). Sem "TBD/TODO".
- **Consistência de tipos:** nomes de tabelas/campos idênticos entre migrations e `src/types/content.ts`.
