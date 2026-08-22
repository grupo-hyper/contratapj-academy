-- =============================================================================
-- 0001_profiles.sql
-- ContrataPJ Academy — Fase 1 (Auth & perfis)
--
-- Cria a tabela `public.profiles`, o trigger que cria uma linha de perfil
-- automaticamente quando um usuário é criado no Supabase Auth (auth.users),
-- e as políticas de Row Level Security (RLS) por papel.
--
-- Papéis (role):
--   - 'aluno'  (padrão) — lê/edita apenas o próprio perfil
--   - 'gestor'          — lê todos os perfis
--   - 'autor'           — lê todos os perfis
--
-- Datas são gravadas em UTC (now() -> timestamptz). A exibição em BRT é
-- responsabilidade do app.
--
-- Esta migration é escrita para ser re-executável (idempotente onde prático):
--   - create table if not exists
--   - create or replace function
--   - drop trigger/policy if exists antes de (re)criar
--
-- Aplicar manualmente via Supabase SQL Editor. Ver supabase/README.md.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Tabela de perfis
-- -----------------------------------------------------------------------------
-- `id` referencia auth.users(id). ON DELETE CASCADE: apagar o usuário no Auth
-- remove o perfil correspondente.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nome       text,
  role       text not null default 'aluno'
               check (role in ('aluno', 'gestor', 'autor')),
  avatar_url text,
  created_at timestamptz not null default now()
);

comment on table  public.profiles is 'Perfis de usuário da ContrataPJ Academy (1:1 com auth.users).';
comment on column public.profiles.role is 'Papel de acesso: aluno (padrão), gestor ou autor.';

-- -----------------------------------------------------------------------------
-- 2) Função helper: papel do usuário atual (evita recursão de RLS)
-- -----------------------------------------------------------------------------
-- POR QUE ISSO EXISTE / COMO EVITA RECURSÃO:
-- Uma política de SELECT em `profiles` do tipo "gestor lê tudo" precisa
-- descobrir o papel do usuário atual — o que naturalmente exigiria consultar
-- a própria tabela `profiles`. Se essa consulta fosse feita diretamente dentro
-- da política (ex.: EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() ...)),
-- o Postgres reaplicaria a MESMA política sobre essa subconsulta, gerando
-- recursão infinita ("infinite recursion detected in policy for relation
-- profiles").
--
-- SOLUÇÃO: encapsular a leitura do papel numa função SECURITY DEFINER. Ela roda
-- com os privilégios do dono da função (que ignora RLS), então a subconsulta
-- NÃO dispara a política de `profiles` e a recursão é quebrada.
--
-- SEGURANÇA: `set search_path = public` fixa o schema de resolução de nomes,
-- impedindo que um search_path malicioso do chamador redirecione `profiles`
-- para um objeto forjado — prática recomendada para funções SECURITY DEFINER.
-- `stable` permite ao planner cachear o resultado dentro da mesma query.
create or replace function public.current_user_role()
  returns text
  language sql
  security definer
  stable
  set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

comment on function public.current_user_role() is
  'Retorna o papel do usuário autenticado. SECURITY DEFINER para ignorar RLS e evitar recursão nas políticas de profiles.';

-- -----------------------------------------------------------------------------
-- 3) Trigger: cria o perfil quando um usuário nasce no Auth
-- -----------------------------------------------------------------------------
-- handle_new_user roda como SECURITY DEFINER porque o INSERT em public.profiles
-- acontece no contexto do Auth (schema auth), fora de qualquer sessão de
-- usuário autenticado — precisa de privilégio para inserir ignorando a RLS.
--
-- `nome` é extraído dos metadados do signup (raw_user_meta_data), aceitando
-- tanto a chave 'nome' quanto 'name'. `nullif(..., '')` normaliza string vazia
-- para NULL. `role` fica com o default da tabela ('aluno').
--
-- `on conflict (id) do nothing` torna o trigger idempotente: se o perfil já
-- existir (re-execução, backfill manual, etc.), não quebra o fluxo de signup.
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  insert into public.profiles (id, nome)
  values (
    new.id,
    nullif(
      coalesce(
        new.raw_user_meta_data ->> 'nome',
        new.raw_user_meta_data ->> 'name'
      ),
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Trigger AFTER INSERT em auth.users: cria a linha correspondente em public.profiles.';

-- (Re)cria o trigger de forma idempotente.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 4) Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- SELECT: o usuário lê o próprio perfil; gestor e autor leem todos.
-- Usa a função helper (SECURITY DEFINER) para descobrir o papel sem recursão.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.current_user_role() in ('gestor', 'autor')
  );

-- UPDATE: o usuário atualiza APENAS o próprio perfil.
-- USING       -> quais linhas ele pode alvejar (só a dele).
-- WITH CHECK  -> a linha resultante ainda precisa ser dele (impede reatribuir
--                o perfil para outro id).
--
-- NOTA SOBRE ESCALONAMENTO DE PAPEL: esta política, por si só, permitiria que
-- o próprio usuário alterasse a coluna `role` na sua linha (ex.: aluno -> autor).
-- O gerenciamento de papéis é responsabilidade de um fluxo admin/CMS (fase
-- posterior), não deste caminho de auto-edição. Um "trava" simples e robusto
-- é bloquear a mudança de `role` num trigger BEFORE UPDATE — feito abaixo — em
-- vez de tentar expressar isso na cláusula da policy (que não enxerga o valor
-- antigo de forma confiável). Assim o usuário edita nome/avatar livremente, mas
-- não consegue se auto-promover.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Trava anti-escalonamento: impede que o próprio dono altere seu `role` pelo
-- caminho de auto-edição. Mudanças de papel devem passar por um fluxo com
-- privilégio elevado (SECURITY DEFINER / service_role), que não é bloqueado
-- aqui porque este trigger só reage a UPDATE e a lógica compara os valores.
-- O service_role/CMS pode contornar recriando o valor via função definer
-- dedicada (a ser criada quando o gerenciamento de papéis existir).
create or replace function public.profiles_prevent_role_change()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  -- Se o papel mudou e quem faz a mudança NÃO é service_role, rejeita.
  if new.role is distinct from old.role
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
  then
    raise exception 'Alteração de role não é permitida por auto-edição (use o fluxo admin).'
      using errcode = '42501'; -- insufficient_privilege
  end if;
  return new;
end;
$$;

comment on function public.profiles_prevent_role_change() is
  'Bloqueia auto-escalonamento de role em profiles; só service_role pode alterar role.';

drop trigger if exists trg_profiles_prevent_role_change on public.profiles;
create trigger trg_profiles_prevent_role_change
  before update on public.profiles
  for each row
  execute function public.profiles_prevent_role_change();

-- INSERT: intencionalmente SEM policy de INSERT para o cliente.
-- As linhas de profiles são criadas exclusivamente pelo trigger
-- handle_new_user (SECURITY DEFINER), que ignora RLS. Não há caminho legítimo
-- para o cliente inserir perfis por conta própria; omitir a policy de INSERT
-- significa que qualquer INSERT vindo do papel `authenticated` é negado por
-- padrão (RLS nega o que não é explicitamente permitido).

-- DELETE: também sem policy — perfis são removidos via cascade quando o
-- usuário é apagado no Auth. Não expomos DELETE ao cliente.
