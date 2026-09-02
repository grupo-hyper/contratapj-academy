-- =============================================================================
-- 0006_goals.sql
-- ContrataPJ Academy — Fase 5 (Cadeia de metas & gestão)
--
-- Cria a base de TURMAS e a CADEIA DE METAS do produto:
--   - classes       : turmas, cada uma pertencente a um gestor.
--   - enrollments    : matrícula de um aluno numa turma (base do "ritmo": o
--                      created_at é o marco zero a partir do qual medimos o
--                      progresso esperado).
--   - class_goals    : a meta da turma. NESTA VERSÃO a meta é APENAS o RITMO
--                      GLOBAL (módulos por semana) — decisão de produto: "só
--                      ritmo global, sem prazo por módulo". Não há metas
--                      individuais nem prazos por módulo na v1. O status
--                      "em dia/atrasado" é calculado no app: módulos concluídos
--                      vs. esperado (= modules_per_week * semanas desde a
--                      matrícula).
--
-- MODELO DE ACESSO (resumo):
--   - GESTOR escreve (cria/edita/apaga) turmas, matrículas e metas.
--   - ALUNO lê SOMENTE o que lhe diz respeito: as turmas em que está matriculado,
--     a própria matrícula e a meta dessas turmas. Não escreve nada aqui.
--   - AUTOR não tem papel nesta área (sem acesso além do que a RLS liberar; as
--     policies abaixo não o incluem, então ele não lê nem escreve).
--   - Papel do chamador via public.current_user_role() (definido em 0001).
--   - profiles.id = auth.uid() (0001), então "dono" compara com auth.uid().
--
-- Datas em UTC (timestamptz -> now()); conversão para BRT é feita no app.
--
-- Idempotente / re-executável (convenção de 0001-0005):
--   - create table if not exists / create index if not exists
--   - drop policy if exists antes de create policy
--
-- Aplicar manualmente via Supabase SQL Editor, DEPOIS de 0005. NÃO é aplicada
-- automaticamente (ver supabase/README.md e memória de deploy de migrations).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Tabela: classes (turmas)
-- -----------------------------------------------------------------------------
-- Uma turma pertence a um gestor (gestor_id). Apagar o perfil do gestor cascata
-- para as turmas dele (e, por FK abaixo, para matrículas e metas dessas turmas).
create table if not exists public.classes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(btrim(nome)) > 0),
  gestor_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table  public.classes is 'Turmas. Cada turma pertence a um gestor (gestor_id). RLS: gestor escreve as suas; aluno lê as em que está matriculado.';
comment on column public.classes.gestor_id is 'Dono da turma; = profiles.id de um usuário com role gestor.';
comment on column public.classes.created_at is 'Criação (UTC); exibição em BRT.';

create index if not exists idx_classes_gestor_id on public.classes (gestor_id);

-- -----------------------------------------------------------------------------
-- 2) Tabela: enrollments (matrículas)
-- -----------------------------------------------------------------------------
-- Liga um aluno (profile_id) a uma turma (class_id). O created_at é o MARCO ZERO
-- do ritmo do aluno: o progresso esperado é medido a partir dele. unique
-- (profile_id, class_id) impede matrícula duplicada na mesma turma.
create table if not exists public.enrollments (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  class_id   uuid not null references public.classes (id)  on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, class_id)
);

comment on table  public.enrollments is 'Matrícula de um aluno numa turma. created_at = marco zero do ritmo. RLS: gestor escreve; aluno lê as suas.';
comment on column public.enrollments.created_at is 'Início do aluno na turma (UTC). Base do cálculo de ritmo esperado.';

create index if not exists idx_enrollments_profile_id on public.enrollments (profile_id);
create index if not exists idx_enrollments_class_id   on public.enrollments (class_id);

-- -----------------------------------------------------------------------------
-- 3) Tabela: class_goals (meta da turma — SÓ RITMO GLOBAL)
-- -----------------------------------------------------------------------------
-- Uma meta por turma (class_id unique). modules_per_week é o ritmo alvo em
-- módulos por semana (numeric permite meias-metas, ex.: 0.5 = 1 módulo a cada 2
-- semanas). check (> 0) garante ritmo positivo. Sem prazo por módulo, sem meta
-- individual, sem meta_acerto nesta versão (decisão: "só ritmo global").
create table if not exists public.class_goals (
  id               uuid primary key default gen_random_uuid(),
  class_id         uuid not null unique references public.classes (id) on delete cascade,
  modules_per_week numeric not null check (modules_per_week > 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table  public.class_goals is 'Meta da turma. v1: SÓ ritmo global (modules_per_week). Uma meta por turma. RLS: gestor escreve; aluno lê a da sua turma.';
comment on column public.class_goals.modules_per_week is 'Ritmo alvo em módulos por semana (numeric > 0). Status em dia/atrasado é calculado no app.';
comment on column public.class_goals.updated_at is 'Última atualização (UTC). Trigger mantém atual em UPDATE.';

create index if not exists idx_class_goals_class_id on public.class_goals (class_id);

-- Trigger: mantém updated_at atual em UPDATE (mesmo padrão de 0003).
create or replace function public.class_goals_touch_updated_at()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.class_goals_touch_updated_at() is
  'Trigger BEFORE UPDATE em class_goals: força updated_at = now().';

drop trigger if exists trg_class_goals_touch_updated_at on public.class_goals;
create trigger trg_class_goals_touch_updated_at
  before update on public.class_goals
  for each row
  execute function public.class_goals_touch_updated_at();

-- =============================================================================
-- 4) Row Level Security
-- =============================================================================
-- Padrão: gestor escreve; aluno lê o que lhe diz respeito. RLS nega por default.

alter table public.classes     enable row level security;
alter table public.enrollments enable row level security;
alter table public.class_goals enable row level security;

-- -----------------------------------------------------------------------------
-- 4.1) classes
-- -----------------------------------------------------------------------------
-- SELECT: o gestor DONO lê as suas turmas; o aluno lê as turmas em que está
-- matriculado (via enrollments). (Um gestor só enxerga as próprias turmas — não
-- as de outros gestores.)
drop policy if exists classes_select on public.classes;
create policy classes_select
  on public.classes
  for select
  to authenticated
  using (
    gestor_id = auth.uid()
    or exists (
      select 1 from public.enrollments e
      where e.class_id = classes.id
        and e.profile_id = auth.uid()
    )
  );

-- INSERT: só gestor, e a turma tem de nascer como sua (gestor_id = auth.uid()).
drop policy if exists classes_insert on public.classes;
create policy classes_insert
  on public.classes
  for insert
  to authenticated
  with check (
    public.current_user_role() = 'gestor'
    and gestor_id = auth.uid()
  );

-- UPDATE: só o gestor dono; não pode "transferir" a turma para outro gestor.
drop policy if exists classes_update on public.classes;
create policy classes_update
  on public.classes
  for update
  to authenticated
  using (public.current_user_role() = 'gestor' and gestor_id = auth.uid())
  with check (public.current_user_role() = 'gestor' and gestor_id = auth.uid());

-- DELETE: só o gestor dono.
drop policy if exists classes_delete on public.classes;
create policy classes_delete
  on public.classes
  for delete
  to authenticated
  using (public.current_user_role() = 'gestor' and gestor_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 4.2) enrollments
-- -----------------------------------------------------------------------------
-- SELECT: o aluno lê as próprias matrículas; o gestor dono da turma lê as
-- matrículas da sua turma (para montar o dashboard do time).
drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select
  on public.enrollments
  for select
  to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.classes c
      where c.id = enrollments.class_id
        and c.gestor_id = auth.uid()
    )
  );

-- INSERT: só o gestor dono da turma matricula alunos nela.
drop policy if exists enrollments_insert on public.enrollments;
create policy enrollments_insert
  on public.enrollments
  for insert
  to authenticated
  with check (
    public.current_user_role() = 'gestor'
    and exists (
      select 1 from public.classes c
      where c.id = enrollments.class_id
        and c.gestor_id = auth.uid()
    )
  );

-- UPDATE: só o gestor dono da turma (raro, mas simétrico).
drop policy if exists enrollments_update on public.enrollments;
create policy enrollments_update
  on public.enrollments
  for update
  to authenticated
  using (
    public.current_user_role() = 'gestor'
    and exists (
      select 1 from public.classes c
      where c.id = enrollments.class_id and c.gestor_id = auth.uid()
    )
  )
  with check (
    public.current_user_role() = 'gestor'
    and exists (
      select 1 from public.classes c
      where c.id = enrollments.class_id and c.gestor_id = auth.uid()
    )
  );

-- DELETE: só o gestor dono da turma (desmatricular).
drop policy if exists enrollments_delete on public.enrollments;
create policy enrollments_delete
  on public.enrollments
  for delete
  to authenticated
  using (
    public.current_user_role() = 'gestor'
    and exists (
      select 1 from public.classes c
      where c.id = enrollments.class_id and c.gestor_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 4.3) class_goals
-- -----------------------------------------------------------------------------
-- SELECT: o gestor dono da turma lê a meta; o aluno matriculado lê a meta da sua
-- turma (para ver ritmo alvo vs. real no painel de metas).
drop policy if exists class_goals_select on public.class_goals;
create policy class_goals_select
  on public.class_goals
  for select
  to authenticated
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_goals.class_id
        and (
          c.gestor_id = auth.uid()
          or exists (
            select 1 from public.enrollments e
            where e.class_id = c.id and e.profile_id = auth.uid()
          )
        )
    )
  );

-- INSERT/UPDATE/DELETE: só o gestor dono da turma define/edita/remove a meta.
drop policy if exists class_goals_insert on public.class_goals;
create policy class_goals_insert
  on public.class_goals
  for insert
  to authenticated
  with check (
    public.current_user_role() = 'gestor'
    and exists (
      select 1 from public.classes c
      where c.id = class_goals.class_id and c.gestor_id = auth.uid()
    )
  );

drop policy if exists class_goals_update on public.class_goals;
create policy class_goals_update
  on public.class_goals
  for update
  to authenticated
  using (
    public.current_user_role() = 'gestor'
    and exists (
      select 1 from public.classes c
      where c.id = class_goals.class_id and c.gestor_id = auth.uid()
    )
  )
  with check (
    public.current_user_role() = 'gestor'
    and exists (
      select 1 from public.classes c
      where c.id = class_goals.class_id and c.gestor_id = auth.uid()
    )
  );

drop policy if exists class_goals_delete on public.class_goals;
create policy class_goals_delete
  on public.class_goals
  for delete
  to authenticated
  using (
    public.current_user_role() = 'gestor'
    and exists (
      select 1 from public.classes c
      where c.id = class_goals.class_id and c.gestor_id = auth.uid()
    )
  );
