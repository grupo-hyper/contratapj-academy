-- =============================================================================
-- 0008_admin_bypass.sql
-- ContrataPJ Academy — BYPASS DE ADMIN na RLS (por e-mail, igual à allowlist da UI)
--
-- Problema: a allowlist de admin (src/auth/admins.ts) só libera a UI (RequireRole).
-- A RLS usa public.current_user_role() (= profiles.role), então um admin cujo
-- papel no banco é 'aluno' NÃO lê/escreve as tabelas só-autor (questions,
-- question_options) nem as de gestão (classes/enrollments/class_goals). Resultado:
-- o CMS abre mas o editor de quiz vem vazio e as escritas falham.
--
-- Solução: uma função public.is_admin() (SECURITY DEFINER, checa o e-mail do
-- usuário logado contra a allowlist) e POLICIES PERMISSIVAS adicionais "*_admin_all"
-- em cada tabela relevante. Policies permissivas são OR'd: o admin ganha acesso
-- total SEM alterar o comportamento de aluno/autor/gestor comuns. O admin continua
-- escolhendo a VISÃO na UI (sidebar mostra todas); a RLS agora acompanha (acesso full).
--
-- Idempotente: create or replace function + drop policy if exists antes de criar.
-- Aplicar via Supabase SQL Editor (roda como owner, ignora RLS). NÃO é automático.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Função is_admin() — e-mail do usuário logado ∈ allowlist
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER pra ler auth.users (o app não acessa esse schema). STABLE:
-- resultado constante dentro da mesma query. A lista espelha src/auth/admins.ts —
-- ao promover/remover um admin, atualize NOS DOIS lugares.
create or replace function public.is_admin()
  returns boolean
  language sql
  security definer
  set search_path = public, auth
  stable
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and lower(u.email) = any (array[
        'diegodomingos@hypergroup.com.br',
        'camilasouza@hypergroup.com.br',
        'dario@hypergroup.com.br'
      ])
  );
$$;

comment on function public.is_admin() is
  'true se o e-mail do usuário logado está na allowlist de admins (espelha src/auth/admins.ts). Usada para bypass de RLS.';

grant execute on function public.is_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- 2) Policies permissivas de admin (OR com as existentes) — acesso TOTAL
-- -----------------------------------------------------------------------------
-- CMS: módulos, aulas, perguntas e alternativas.
drop policy if exists modules_admin_all on public.modules;
create policy modules_admin_all on public.modules
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists lessons_admin_all on public.lessons;
create policy lessons_admin_all on public.lessons
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists questions_admin_all on public.questions;
create policy questions_admin_all on public.questions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists question_options_admin_all on public.question_options;
create policy question_options_admin_all on public.question_options
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Gestão: turmas, matrículas e metas.
drop policy if exists classes_admin_all on public.classes;
create policy classes_admin_all on public.classes
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists enrollments_admin_all on public.enrollments;
create policy enrollments_admin_all on public.enrollments
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists class_goals_admin_all on public.class_goals;
create policy class_goals_admin_all on public.class_goals
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- 3) GRANT de coluna: admin precisa LER `correta` na tabela base
-- -----------------------------------------------------------------------------
-- 0004/0002 revogaram o SELECT total de question_options e concederam só
-- (id, question_id, texto, created_at) — escondendo o gabarito `correta` do aluno.
-- O editor do autor/admin lê a base COM `correta`, então concedemos a coluna que
-- faltava. Isso é SEGURO: a RLS de linha continua só-autor/admin, então aluno
-- comum não lê nenhuma linha da base (usa a view question_options_public).
grant select (correta) on public.question_options to authenticated;
