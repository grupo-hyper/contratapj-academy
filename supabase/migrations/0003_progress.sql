-- =============================================================================
-- 0003_progress.sql
-- ContrataPJ Academy — Fase 3 (Progresso do aluno & trilha sequencial)
--
-- Cria a tabela `lesson_progress`, que registra o progresso de CADA usuário em
-- CADA aula (percentual assistido + flag de conclusão). É a fonte de verdade da
-- TRILHA SEQUENCIAL TRAVADA da Home: o módulo N+1 só abre quando todas as aulas
-- publicadas do módulo N estão concluídas (o cálculo de liberação em si vive no
-- app, em src/features/home/useUnlock.ts — aqui guardamos só os dados).
--
-- MODELO DE ACESSO (resumo):
--   - Tabela PURAMENTE POR USUÁRIO (owner-only): cada autenticado lê e escreve
--     SOMENTE as próprias linhas. NÃO há lógica de papel (aluno/gestor/autor)
--     aqui — o progresso é sempre individual.
--   - Como `profile_id` referencia profiles(id) e, por 0001, profiles.id É o
--     próprio auth.users.id (= auth.uid()), o predicado de RLS é simplesmente
--     `profile_id = auth.uid()` em SELECT/INSERT/UPDATE/DELETE. Não usamos
--     current_user_role() — não é necessário para dados por-usuário.
--
-- Datas em UTC (timestamptz -> now()); conversão para BRT é feita no app.
--
-- Idempotente / re-executável, seguindo a convenção de 0001 e 0002:
--   - create table if not exists
--   - create index if not exists
--   - drop policy if exists antes de create policy
--
-- Aplicar manualmente via Supabase SQL Editor, DEPOIS de 0002. Ver
-- supabase/README.md. NÃO é aplicada automaticamente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Tabela: lesson_progress
-- -----------------------------------------------------------------------------
-- Uma linha por (usuário, aula). `unique (profile_id, lesson_id)` garante um
-- único registro de progresso por aula por usuário (upsert-friendly).
--   - `pct`       : percentual assistido, 0..100 (check).
--   - `concluida` : se true, a aula conta como concluída para a trilha.
--   - `updated_at`: instante da última atualização (o app deve setar no upsert;
--                   default now() cobre o insert inicial).
-- FKs ON DELETE CASCADE: apagar o perfil (ou o usuário no Auth, que cascata
-- para profiles) ou a aula remove o progresso correspondente.
create table if not exists public.lesson_progress (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id  uuid not null references public.lessons (id)  on delete cascade,
  pct        int  not null default 0 check (pct between 0 and 100),
  concluida  boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (profile_id, lesson_id)
);

comment on table  public.lesson_progress is 'Progresso por (usuário, aula): percentual assistido + conclusão. Owner-only via RLS. Base da trilha sequencial.';
comment on column public.lesson_progress.profile_id is 'Dono do progresso; = profiles.id = auth.uid(). RLS restringe a este usuário.';
comment on column public.lesson_progress.pct is 'Percentual assistido da aula, 0..100.';
comment on column public.lesson_progress.concluida is 'Se true, a aula conta como concluída para liberar o próximo módulo.';
comment on column public.lesson_progress.updated_at is 'Última atualização (UTC). App deve atualizar no upsert; exibição em BRT.';

-- -----------------------------------------------------------------------------
-- 2) Índices auxiliares
-- -----------------------------------------------------------------------------
-- Índice em (profile_id): a Home busca todo o progresso do usuário atual.
-- Índice em (lesson_id): joins/consultas por aula.
-- (A constraint unique já cria um índice sobre (profile_id, lesson_id).)
create index if not exists idx_lesson_progress_profile_id on public.lesson_progress (profile_id);
create index if not exists idx_lesson_progress_lesson_id  on public.lesson_progress (lesson_id);

-- =============================================================================
-- 3) Row Level Security — OWNER-ONLY
-- =============================================================================
-- Cada usuário só enxerga e só mexe nas próprias linhas. RLS nega por padrão o
-- que não for explicitamente liberado; abaixo liberamos apenas o próprio dono.
alter table public.lesson_progress enable row level security;

-- SELECT: só as linhas do próprio usuário.
drop policy if exists lesson_progress_select_own on public.lesson_progress;
create policy lesson_progress_select_own
  on public.lesson_progress
  for select
  to authenticated
  using (profile_id = auth.uid());

-- INSERT: só pode inserir linhas para si mesmo. WITH CHECK impede que o usuário
-- grave progresso em nome de OUTRO profile_id.
drop policy if exists lesson_progress_insert_own on public.lesson_progress;
create policy lesson_progress_insert_own
  on public.lesson_progress
  for insert
  to authenticated
  with check (profile_id = auth.uid());

-- UPDATE: só pode atualizar as próprias linhas (USING) e não pode "mover" a
-- linha para outro profile_id (WITH CHECK).
drop policy if exists lesson_progress_update_own on public.lesson_progress;
create policy lesson_progress_update_own
  on public.lesson_progress
  for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- DELETE: só pode apagar as próprias linhas.
drop policy if exists lesson_progress_delete_own on public.lesson_progress;
create policy lesson_progress_delete_own
  on public.lesson_progress
  for delete
  to authenticated
  using (profile_id = auth.uid());
