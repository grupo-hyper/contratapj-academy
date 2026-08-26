# Painel do Gestor — Fase 5 (Cadeia de metas & gestão)

**Data:** 2026-08-26
**Status:** Design aprovado (aguardando review do spec → plano de implementação)
**Projeto:** ContrataPJ Academy (`~/contratapj-academy/`, `grupo-hyper/contratapj-academy`, branch `main`)

---

## Contexto

A Fase 5 introduziu a **cadeia de metas** (migration `0006_goals.sql`, já aplicada no
remoto): `classes` (turmas), `enrollments` (matrículas, cujo `created_at` é o marco zero
do ritmo) e `class_goals` (meta = **ritmo global**, `modules_per_week`). O lado **aluno**
já está pronto e verde: `GoalsPage` + `useGoals` (`/metas`) mostram "em dia / atrasado /
adiantado" reaproveitando a função pura `computeGoalStatus`.

Falta o lado **gestor**: hoje a rota `/gestor` renderiza `GestorStub` ("Painel do gestor").
Este spec cobre o **Painel do Gestor** — a tela onde o gestor cria turmas, matricula
alunos, define a meta de ritmo e acompanha o progresso de cada aluno.

## Objetivo

Entregar o Painel do Gestor com **CRUD completo + visão de progresso**, consumindo a RLS
já existente no `0006` e adicionando **um único** artefato de servidor (RPC de busca por
e-mail). Manter a suíte de testes verde.

## Fora de escopo (YAGNI)

- Metas individuais por aluno e prazos por módulo (a meta v1 é só ritmo global da turma).
- Múltiplos gestores por turma.
- Promover papel (aluno→gestor) pela tela — segue manual via SQL.
- Criação de usuário no Auth pela tela — segue à parte (Management API / Dashboard).
- CMS do autor (Fase 6).

---

## Fatos de RLS que sustentam o design (verificados no código)

- `classes`: gestor **dono** faz SELECT/INSERT/UPDATE/DELETE das suas turmas
  (`gestor_id = auth.uid()` + `current_user_role()='gestor'`). Aluno lê as turmas em que
  está matriculado.
- `enrollments`: gestor **dono da turma** lê e escreve as matrículas dela; aluno lê as suas.
- `class_goals`: gestor **dono** escreve; aluno lê a da sua turma.
- `quiz_attempts` (0004) SELECT: **gestor lê todas** as tentativas → dá pra medir o
  progresso dos alunos direto, sem RPC.
- `profiles` (0001) SELECT: gestor lê **todos** os perfis → pega nome/role dos alunos.

**Consequência:** só a **matrícula por e-mail** precisa de servidor, porque `profiles`
não guarda e-mail (ele vive em `auth.users`, que o cliente não lê). Todo o resto é query
direta governada por RLS.

---

## Arquitetura & acesso

- Rota **`/gestor`** (mantém o path que a sidebar já linka em `AppSidebar`), trocando
  `GestorStub` por `GestaoPage`, com `RequireRole allow={['gestor']}`. Admins da allowlist
  (`isAdminEmail`) entram por cima do gate, como nas demais visões.
- Cada gestor opera **só as próprias turmas** — nada de código de permissão novo, só
  consumir a RLS existente.
- Atribuição do papel `gestor` fica **fora** desta tela (via SQL / Management API).

## Componentes / unidades

### 1. `supabase/migrations/0007_find_profile_by_email.sql` (novo)

RPC `public.find_profile_by_email(p_email text)`:

- `returns table(id uuid, nome text, role text)`
- `language sql` ou `plpgsql`, `security definer`, `set search_path = public`, `stable`.
- **Guarda de papel:** responde apenas quando `current_user_role() = 'gestor'`; caso
  contrário levanta exceção `42501` (insufficient_privilege). (Motivo: SECURITY DEFINER
  ignora RLS; sem a guarda, qualquer autenticado resolveria e-mail→perfil — vetor de
  enumeração.)
- Faz join `auth.users u` → `public.profiles p` por `lower(u.email) = lower(btrim(p_email))`.
  Retorna 0 ou 1 linha.
- `grant execute ... to authenticated`.
- Idempotente (`create or replace function`). Aplicada manualmente no SQL Editor
  **depois** de `0006` (o SQL é colado no chat para o Diego aplicar).

### 2. `src/features/gestao/useGestao.ts` (novo) — camada de dados

Funções puras/isoladas + hook `useGestao()`. Cada função tem um propósito único e é
testável com o `supabase` client mockado:

- `listClasses()` → turmas do gestor (`classes` sob RLS) com a meta (`class_goals`) e as
  matrículas.
- `createClass(nome)` / `renameClass(id, nome)` / `deleteClass(id)`.
- `upsertGoal(classId, modulesPerWeek)` — `modules_per_week` inteiro ≥ 1; upsert por
  `class_id` (unique).
- `findProfileByEmail(email)` — chama o RPC; devolve `{id, nome, role}` ou `null`.
- `enroll(classId, profileId)` — insere em `enrollments`; traduz `23505` (unique) em
  "já matriculado".
- `unenroll(enrollmentId)` — delete em `enrollments`.
- `classProgress(...)` — para cada matrícula, calcula o status com `computeGoalStatus`
  (importado de `src/features/goals/useGoals.ts`), usando: módulos concluídos (distintos,
  de `quiz_attempts` aprovados do aluno), total de módulos publicados, `modules_per_week`
  da turma e `enrollments.created_at` como marco zero.

Notas de implementação:
- Reusar `computeGoalStatus` por import direto. Se o acoplamento ao arquivo `useGoals.ts`
  incomodar (ele carrega muita coisa do lado aluno), extrair a função pura + tipos para
  `src/features/goals/goalStatus.ts` e reexportar — decisão a tomar no plano, sem mudar
  comportamento.
- `now` injetável no cálculo (como já é em `computeGoalStatus`) para testes determinísticos.
- Contagem de "concluído" deve seguir a mesma regra do lado aluno (`countConcludedModules`)
  para consistência.

### 3. `src/features/gestao/GestaoPage.tsx` (novo) — UI

Identidade dark/ocean já estabelecida. Estrutura:

- **Lista de turmas** em cards: nome, meta (`X mód/semana`, editável inline), nº de alunos.
- **Nova turma**: campo nome + botão criar.
- **Meta**: editar `modules_per_week` inline por turma.
- **Matricular por e-mail**: campo de e-mail → `findProfileByEmail` → confirma nome/role →
  `enroll`. Estados: não encontrado, já matriculado, sem permissão, sucesso.
- **Alunos da turma**: lista com nome + barra de progresso + status (em dia / atrasado /
  adiantado) + `concluídos/esperado` + botão "remover" (`unenroll`).
- **Apagar turma** (com confirmação; cascata remove matrículas e meta).

### 4. Rota / router

`src/router.tsx`: substituir `GestorStub` por `GestaoPage` na rota `/gestor`
(`RequireRole allow={['gestor']}`). Remover o import do stub se ficar órfão.

---

## Fluxo de dados (matrícula por e-mail)

1. Gestor digita `aluno@empresa.com` no card da turma.
2. UI chama `findProfileByEmail(email)` → RPC (gestor-only) resolve `auth.users`→`profiles`.
3. Achou → mostra `{nome} ({role})` e botão confirmar → `enroll(classId, profileId)`.
4. Insert em `enrollments` sob RLS (gestor dono). `created_at` = marco zero do ritmo.
5. A lista de progresso recarrega e o aluno aparece com status inicial.

Erros: e-mail vazio/inválido (validação client), não encontrado (RPC 0 linhas),
já matriculado (`23505`), sem permissão (RPC 42501 — não deveria ocorrer para gestor).

## Tratamento de erros

- Toda ação de escrita trata a falha e mostra mensagem amigável (padrão das outras telas).
- `deleteClass`/`unenroll` pedem confirmação antes de agir (ação destrutiva).
- Falhas de rede/RLS não deixam a UI em estado inconsistente (recarrega a lista após ação).

## Testes

- **`computeGoalStatus`**: já coberto (lado aluno) — reutilizado, sem novo teste do núcleo.
- **`useGestao`** (supabase mockado): CRUD de turma, upsert de meta, `findProfileByEmail`
  (achou / não achou / 42501), `enroll` (sucesso / `23505`), `unenroll`, `classProgress`
  (com `now` fixo: em dia / atrasado / adiantado).
- **`GestaoPage`**: render de turmas, criar turma, editar meta, matricular (sucesso e erro
  "não encontrado" / "já matriculado"), lista de progresso, remover aluno.
- A suíte inteira permanece verde (`npm test`).

## Deploy

- Código: commit na `main` → push manual do Diego → GitHub Actions publica no Pages.
- Migration `0007`: **não** sobe pelo deploy; o SQL é colado no chat e o Diego aplica no
  SQL Editor do Supabase (projeto `xbolgzabgtxzbpskokxj`), depois de `0006`.
- Para testar de ponta a ponta é preciso um usuário `role='gestor'` no banco (definido via
  Management API / SQL) — a tela em si não promove papéis.

## Riscos / pontos de atenção

- **Reuso de `computeGoalStatus`** cria dependência `gestao → goals`. Mitigação: extrair
  para `goalStatus.ts` compartilhado se o acoplamento incomodar.
- **RPC SECURITY DEFINER**: a guarda de papel é obrigatória; sem ela vira vetor de
  enumeração de e-mails. Testar o caminho 42501.
- **Consistência da contagem** de módulos concluídos entre lado aluno e lado gestor.
