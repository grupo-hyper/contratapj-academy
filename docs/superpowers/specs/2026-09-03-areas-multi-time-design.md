# Design — Áreas (playbooks multi-time na Academy)

**Data:** 2026-09-03
**Projeto:** contratapj-academy
**Status:** Aprovado (design). Implementação faseada (F1 → F2 → F3).

---

## Contexto e objetivo

Hoje a Academy tem **uma trilha única** (os playbooks do time Comercial): `modules`
(ordem 1..12 única) → `lessons` → `questions`/`question_options`. A Home renderiza
essa trilha diretamente.

Agora **todos os times da empresa** (CS, Financeiro, Marketing, RH, Produto, etc.)
vão publicar seus próprios playbooks na Academy. Precisamos de um nível de
organização **acima dos módulos**: a **Área** (= um time/departamento), cada uma com
seu conjunto de módulos/aulas/quiz, com controle de visibilidade e de edição.

Decisões de produto (confirmadas):

- **Visibilidade mista:** cada área é **pública** (todos veem) ou **restrita** (só
  membros + admin).
- **Acesso restrito por associação pessoa↔área:** uma pessoa pode ser membro de
  várias áreas restritas.
- **Autoria híbrida:** cada área tem **curador(es)** que editam só a própria área;
  **admins** (allowlist de e-mail, já existente) editam qualquer área.
- Entidade chamada **"Área"**. A **Comercial** entra como área **pública**.
- **Turmas/metas/certificados continuam globais** (foco Comercial) — fora do escopo
  desta reorganização; revisitar depois.

---

## Modelo de dados

### `areas`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `nome` | text not null | ex.: "Comercial", "Customer Success" |
| `slug` | text unique not null | usado na URL `/area/:slug` (ex.: `comercial`) |
| `descricao` | text | opcional |
| `capa_url` | text | capa do card no hub (por URL, sem upload) |
| `visibilidade` | text not null default `'publica'` | check in (`'publica'`,`'restrita'`) |
| `ordem` | int not null | ordena os cards no hub |
| `publicado` | boolean not null default true | rascunho = só admin/curador vê |
| `created_at` | timestamptz not null default now() | |

### `area_members` (entra na Fase 2)
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `area_id` | uuid FK → areas(id) on delete cascade | |
| `profile_id` | uuid FK → profiles(id) on delete cascade | |
| `papel` | text not null | check in (`'membro'`,`'curador'`); membro = vê, curador = vê+edita |
| `created_at` | timestamptz not null default now() | |
| | | **unique(area_id, profile_id)** |

### `modules` (alteração)
- **+ `area_id` uuid not null** references `areas(id)` on delete cascade.
- `unique(ordem)` → **`unique(area_id, ordem)`** (cada área tem sua própria sequência).
- Remover `check (ordem between 1 and 12)` → **`check (ordem >= 1)`** (sem teto fixo).
- Backfill: no momento da migration, todos os módulos existentes recebem o
  `area_id` da área "Comercial" (criada na mesma migration), então a coluna vira
  NOT NULL.

`lessons`, `questions`, `question_options` **não mudam de estrutura** — herdam a área
via `module_id → modules.area_id`.

---

## Regras de acesso (efetivas a partir da Fase 2)

Funções helper (SQL), no estilo do `is_admin()` já existente:

- `is_area_member(area_id)` → true se o usuário tem linha em `area_members` (qualquer papel).
- `is_area_curator(area_id)` → true se o usuário tem `papel='curador'` naquela área.

Regras:

- **Ver** uma área e seus módulos/aulas/quiz:
  `areas.publicado = true` **E** (`visibilidade = 'publica'` **OU** `is_area_member(area_id)` **OU** `is_admin()`).
- **Editar** (módulos/aulas/perguntas/alternativas de uma área):
  `is_area_curator(area_id)` **OU** `is_admin()`.

A RLS de conteúdo (modules/lessons/questions/question_options) passa a considerar a
área do módulo. As policies existentes (só-autor, admin) permanecem; adicionamos as
regras de área de forma incremental (F2 leitura, F3 escrita).

---

## Navegação e rotas

- **`/` — Hub de Áreas:** grid de cards (capa + nome) das áreas **visíveis** ao
  usuário (públicas + as restritas de que é membro + todas, se admin), ordenadas por
  `ordem`. Substitui a Home-trilha atual.
- **`/area/:slug` — Trilha da Área:** o layout de trilha atual (módulos → aulas),
  escopado à área do slug. É o que a Home renderiza hoje, agora filtrado por `area_id`.
- **`/aula/:lessonId`** e **`/quiz/:moduleId`** — inalterados na rota; o conteúdo já
  pertence a uma área via o módulo.
- **CMS `/autor`** — ganha contexto de área: seletor/gestão de áreas + a árvore
  Módulos▸Aulas passa a ser da área selecionada.

---

## Faseamento

### Fase 1 — Organizar (sem RLS por área)
- Migration: cria `areas`; cria a área **"Comercial"** (pública, ordem 1); adiciona
  `modules.area_id` e faz backfill p/ Comercial; troca a constraint de ordem para
  `unique(area_id, ordem)` + `check(ordem >= 1)`.
- Front: Home vira **Hub de Áreas**; nova página **Trilha da Área** (`/area/:slug`)
  reusando a lógica/layout da Home atual, filtrando por `area_id`.
- CMS: **gestão de áreas** (admin cria/edita área: nome, slug, descrição, capa,
  visibilidade, ordem, publicado) + a árvore do autor escopada por área (seletor de
  área). Criar módulo passa a exigir a área corrente.
- **Tudo público; edição central** (admin/autor como hoje). `area_members` ainda não
  existe.
- Deploy da F1 antes de começar a F2.

### Fase 2 — Acesso (RLS de leitura por área)
- Migration: cria `area_members` + helpers `is_area_member`/`is_area_curator`.
- RLS: leitura de área/módulos/aulas/quiz passa a respeitar público/restrito/membro
  (+ admin). Áreas restritas somem do hub para quem não é membro.
- UI (admin): gerenciar **membros** de uma área (adicionar/remover pessoa, papel).

### Fase 3 — Curadoria (RLS de escrita por área)
- RLS: escrita de conteúdo (modules/lessons/questions/question_options) passa a exigir
  **curador da área** ou admin.
- CMS: um curador entra em `/autor` e vê/edita **só as áreas de que é curador**;
  admin segue vendo todas.
- UI (admin): atribuir **curador** (papel em `area_members`).

---

## Fora de escopo (YAGNI — revisitar depois)

- **Turmas, metas (class_goals) e certificados** permanecem globais/Comercial; não
  viram per-área nesta reorganização.
- **Upload de capa** — segue por URL.
- **Teto de módulos por área** — sem limite fixo (era 12 global).
- **Sub-áreas / hierarquia** de áreas — não nesta rodada.

---

## Riscos e notas de implementação

- **Migration de `modules` é a parte sensível** (backfill do `area_id` + troca de
  constraint UNIQUE). Aplicar via SQL Editor (regra do projeto), com preview antes.
- A RLS por área (F2/F3) é o ponto de maior cuidado — testar cada regra (público vê,
  restrito esconde, membro vê, curador edita, admin tudo). Seguir o padrão
  incremental de policies permissivas (OR) usado no `0008_admin_bypass`.
- O `is_admin()` (0008) já dá o bypass de admin de graça em todas as regras novas.
- Manter a suíte de testes verde a cada fase (padrão TDD do projeto).
