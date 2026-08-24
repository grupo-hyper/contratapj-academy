-- =============================================================================
-- 0002_content.sql
-- ContrataPJ Academy — Fase 2 (Conteúdo: módulos, aulas, questões)
--
-- Cria o schema de CONTEÚDO do curso e as políticas de Row Level Security (RLS):
--   - modules           : os (até 12) módulos do curso
--   - lessons           : aulas de cada módulo (texto + vídeo do YouTube)
--   - questions         : questões (enunciados) de cada módulo
--   - question_options  : alternativas de cada questão, incluindo o gabarito
--                         (coluna `correta`)
--
-- MODELO DE ACESSO (resumo):
--   - `autor`  : leitura e escrita TOTAL de tudo (inclusive não publicado e o
--                gabarito `correta`). Verificado via public.current_user_role().
--   - demais autenticados (`aluno`, `gestor`):
--       * leem apenas módulos/aulas com publicado = true
--       * leem questões de módulos publicados
--       * leem o TEXTO das alternativas (para responder o quiz) mas NUNCA a
--         coluna `correta` (o gabarito) — ver seção de segurança abaixo.
--
-- Reutiliza a função helper public.current_user_role() criada em 0001
-- (SECURITY DEFINER, STABLE, search_path=public). NÃO a redefinimos aqui.
--
-- Datas em UTC (timestamptz -> now()); conversão para BRT é feita no app.
--
-- Idempotente / re-executável, seguindo a convenção de 0001:
--   - create table if not exists
--   - create index if not exists
--   - create or replace view / function
--   - drop policy if exists antes de create policy
--   - funções SECURITY DEFINER sempre com set search_path = public
--
-- Aplicar manualmente via Supabase SQL Editor, DEPOIS de 0001. Ver
-- supabase/README.md.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Tabela: modules
-- -----------------------------------------------------------------------------
-- `ordem` é 1..12 e UNIQUE: garante no máximo 12 módulos, cada um numa posição
-- fixa e sem posições duplicadas. `publicado` controla a visibilidade para
-- alunos (default false = rascunho, só o autor enxerga).
create table if not exists public.modules (
  id         uuid primary key default gen_random_uuid(),
  ordem      int  not null unique check (ordem between 1 and 12),
  titulo     text not null,
  descricao  text,
  capa_url   text,
  publicado  boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table  public.modules is 'Módulos do curso (até 12). publicado=false é rascunho, visível só para autor.';
comment on column public.modules.ordem is 'Posição do módulo, 1..12, única.';
comment on column public.modules.publicado is 'Se true, o módulo é visível para alunos/gestores.';

-- -----------------------------------------------------------------------------
-- 2) Tabela: lessons
-- -----------------------------------------------------------------------------
-- Uma aula pertence a um módulo (FK ON DELETE CASCADE: apagar o módulo apaga
-- suas aulas). `unique(module_id, ordem)` garante ordem única DENTRO do módulo.
-- `publicado` controla visibilidade da aula independentemente do módulo.
create table if not exists public.lessons (
  id          uuid primary key default gen_random_uuid(),
  module_id   uuid not null references public.modules (id) on delete cascade,
  ordem       int  not null,
  titulo      text not null,
  texto_md    text,
  youtube_id  text,
  duracao_seg int,
  publicado   boolean not null default false,
  created_at  timestamptz default now(),
  unique (module_id, ordem)
);

comment on table  public.lessons is 'Aulas de cada módulo (texto em Markdown + vídeo do YouTube).';
comment on column public.lessons.youtube_id is 'ID do vídeo no YouTube (não a URL completa).';
comment on column public.lessons.duracao_seg is 'Duração da aula em segundos.';

-- -----------------------------------------------------------------------------
-- 3) Tabela: questions
-- -----------------------------------------------------------------------------
-- Uma questão pertence a um módulo (o quiz é por módulo). FK ON DELETE CASCADE.
-- Não há flag de "publicado" na questão: a visibilidade segue a do módulo
-- (questões de módulo publicado são legíveis pelos alunos).
create table if not exists public.questions (
  id         uuid primary key default gen_random_uuid(),
  module_id  uuid not null references public.modules (id) on delete cascade,
  enunciado  text not null,
  created_at timestamptz default now()
);

comment on table public.questions is 'Questões (enunciados) do quiz de cada módulo.';

-- -----------------------------------------------------------------------------
-- 4) Tabela: question_options
-- -----------------------------------------------------------------------------
-- Alternativas de cada questão. A coluna `correta` é o GABARITO — dado
-- sensível que NÃO pode vazar para o aluno (ver seção 6/7). FK ON DELETE
-- CASCADE em relação à questão.
create table if not exists public.question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  texto       text not null,
  correta     boolean not null default false,
  created_at  timestamptz default now()
);

comment on table  public.question_options is 'Alternativas das questões. A coluna `correta` (gabarito) é sensível: nunca exposta a alunos.';
comment on column public.question_options.correta is 'GABARITO. Legível apenas por autor (RLS) e pela RPC de correção (Fase 4, SECURITY DEFINER).';

-- -----------------------------------------------------------------------------
-- 5) Índices auxiliares (FKs)
-- -----------------------------------------------------------------------------
-- Índices nas colunas de FK aceleram joins e as verificações de "módulo
-- publicado" usadas nas políticas/consultas.
create index if not exists idx_lessons_module_id          on public.lessons (module_id);
create index if not exists idx_questions_module_id         on public.questions (module_id);
create index if not exists idx_question_options_question_id on public.question_options (question_id);

-- =============================================================================
-- 6) Row Level Security
-- =============================================================================
alter table public.modules          enable row level security;
alter table public.lessons          enable row level security;
alter table public.questions        enable row level security;
alter table public.question_options enable row level security;

-- -----------------------------------------------------------------------------
-- 6.1) modules — leitura de publicados p/ todos; escrita só autor
-- -----------------------------------------------------------------------------
-- SELECT: qualquer autenticado vê módulos publicados; o autor vê tudo
-- (inclusive rascunhos).
drop policy if exists modules_select on public.modules;
create policy modules_select
  on public.modules
  for select
  to authenticated
  using (
    publicado = true
    or public.current_user_role() = 'autor'
  );

-- WRITE (insert/update/delete): apenas autor.
-- Uma policy FOR ALL cobre insert/update/delete. WITH CHECK garante que a linha
-- resultante de insert/update também satisfaça a condição (só autor grava).
drop policy if exists modules_write_autor on public.modules;
create policy modules_write_autor
  on public.modules
  for all
  to authenticated
  using (public.current_user_role() = 'autor')
  with check (public.current_user_role() = 'autor');

-- -----------------------------------------------------------------------------
-- 6.2) lessons — leitura de aulas publicadas de módulos publicados; escrita autor
-- -----------------------------------------------------------------------------
-- SELECT: autenticado vê a aula se a própria aula E o módulo pai estiverem
-- publicados; autor vê tudo. O EXISTS sobre modules é seguro contra recursão:
-- é uma tabela diferente e a checagem de papel usa a função definer.
drop policy if exists lessons_select on public.lessons;
create policy lessons_select
  on public.lessons
  for select
  to authenticated
  using (
    public.current_user_role() = 'autor'
    or (
      publicado = true
      and exists (
        select 1 from public.modules m
        where m.id = lessons.module_id
          and m.publicado = true
      )
    )
  );

drop policy if exists lessons_write_autor on public.lessons;
create policy lessons_write_autor
  on public.lessons
  for all
  to authenticated
  using (public.current_user_role() = 'autor')
  with check (public.current_user_role() = 'autor');

-- -----------------------------------------------------------------------------
-- 6.3) questions — leitura das questões de módulos publicados; escrita autor
-- -----------------------------------------------------------------------------
-- SELECT: autenticado lê questões cujo módulo esteja publicado; autor vê tudo.
drop policy if exists questions_select on public.questions;
create policy questions_select
  on public.questions
  for select
  to authenticated
  using (
    public.current_user_role() = 'autor'
    or exists (
      select 1 from public.modules m
      where m.id = questions.module_id
        and m.publicado = true
    )
  );

drop policy if exists questions_write_autor on public.questions;
create policy questions_write_autor
  on public.questions
  for all
  to authenticated
  using (public.current_user_role() = 'autor')
  with check (public.current_user_role() = 'autor');

-- -----------------------------------------------------------------------------
-- 6.4) question_options — GABARITO PROTEGIDO
-- -----------------------------------------------------------------------------
-- REQUISITO CRÍTICO DE SEGURANÇA:
--   O aluno precisa LER o texto das alternativas para responder o quiz, mas
--   NÃO PODE ler a coluna `correta` (isso vazaria o gabarito). A RLS do Postgres
--   é por LINHA, não por COLUNA, então não dá para "esconder uma coluna" numa
--   policy. Além disso, no PostgREST/Supabase tanto o autor quanto o aluno
--   acessam o banco pelo MESMO papel do Postgres (`authenticated`) — a distinção
--   entre eles é só o claim de papel no JWT, lido pela nossa função
--   current_user_role(). Por isso GRANTs por coluna no papel `authenticated`
--   sozinhos NÃO conseguiriam liberar `correta` para o autor e bloquear para o
--   aluno (mesmo papel do Postgres para ambos).
--
-- ABORDAGEM ESCOLHIDA — "view split" (opção b do plano):
--   (1) A tabela base question_options fica com RLS que só permite ao AUTOR
--       ler/escrever. Alunos/gestores NÃO têm acesso de leitura à tabela base,
--       logo nunca conseguem selecionar `correta` diretamente por ela.
--   (2) Uma VIEW public.question_options_public expõe apenas as colunas seguras
--       (id, question_id, texto) — SEM `correta` — e só de módulos publicados.
--       A view roda com os direitos do DONO (security_invoker = false), então
--       consegue ler a tabela base ignorando a RLS restritiva dela; a segurança
--       vem de a view (a) não projetar `correta` e (b) filtrar por módulo
--       publicado. É por essa view que o aluno responde o quiz.
--   (3) A correção/nota (Fase 4) será feita por uma RPC SECURITY DEFINER que lê
--       `correta` da tabela base no servidor e devolve só o resultado — o
--       gabarito nunca trafega para o cliente. (Não implementada nesta task.)
--
-- Resultado: não existe caminho pelo qual um `aluno`/`gestor` leia `correta` via
-- a API REST/PostgREST — nem pela tabela base (RLS só-autor) nem pela view (não
-- projeta a coluna).

-- Base: leitura e escrita SOMENTE para autor. Sem policy para leitura de aluno.
drop policy if exists question_options_read_autor on public.question_options;
create policy question_options_read_autor
  on public.question_options
  for select
  to authenticated
  using (public.current_user_role() = 'autor');

drop policy if exists question_options_write_autor on public.question_options;
create policy question_options_write_autor
  on public.question_options
  for all
  to authenticated
  using (public.current_user_role() = 'autor')
  with check (public.current_user_role() = 'autor');

-- =============================================================================
-- 7) View pública de alternativas (sem gabarito) para o aluno responder o quiz
-- =============================================================================
-- Projeta apenas colunas seguras (NUNCA `correta`) e apenas de módulos
-- publicados. Roda com direitos do dono (security_invoker = false) para poder
-- ler a tabela base apesar da RLS só-autor; a segurança está na projeção de
-- colunas + no filtro de módulo publicado abaixo.
--
-- OBS: em Postgres 15+ o default de views é security_invoker = false, mas
-- deixamos explícito para não depender do default e para documentar a intenção.
create or replace view public.question_options_public
  with (security_invoker = false)
as
  select
    qo.id,
    qo.question_id,
    qo.texto
  from public.question_options qo
  join public.questions q on q.id = qo.question_id
  join public.modules   m on m.id = q.module_id
  where m.publicado = true;

comment on view public.question_options_public is
  'Alternativas SEM gabarito (id, question_id, texto) de módulos publicados. Fonte segura para o aluno responder o quiz; a coluna `correta` nunca é exposta aqui.';

-- Permissões da view: como ela roda com direitos do dono e não expõe `correta`,
-- liberamos SELECT para autenticados. Revogamos qualquer acesso de anon/public
-- por precaução (defesa em profundidade).
revoke all on public.question_options_public from anon;
grant select on public.question_options_public to authenticated;

-- Defesa extra em profundidade na tabela BASE: garante que o papel `authenticated`
-- não tenha o privilégio de tabela para ler `correta`. Mesmo que uma policy
-- futura seja afrouxada por engano, o privilégio de coluna continua barrando a
-- leitura do gabarito pela tabela base. O autor lê `correta` mesmo assim porque,
-- na correção, isso passa por uma RPC SECURITY DEFINER (Fase 4); e, no CMS, a
-- edição do gabarito pelo autor deve usar o service_role (que ignora estes
-- grants). Consultas de leitura da tabela base pelo autor via PostgREST devem se
-- limitar às colunas concedidas abaixo.
revoke select on public.question_options from authenticated;
grant  select (id, question_id, texto, created_at) on public.question_options to authenticated;
-- Escrita da tabela base (insert/update/delete) segue liberada ao papel para que
-- as policies só-autor decidam; RLS é o gate efetivo de escrita.
grant insert, update, delete on public.question_options to authenticated;
