-- =============================================================================
-- 0004_quiz.sql
-- ContrataPJ Academy — Fase 4 (Testes & certificados)
--
-- Cria a tabela `public.quiz_attempts` (tentativas de quiz por usuário/módulo) e
-- a RPC de CORREÇÃO server-side `public.submit_quiz(...)`.
--
-- POR QUE A CORREÇÃO É SERVER-SIDE (o ponto central desta migration):
--   O gabarito do quiz mora em `public.question_options.correta` (ver 0002), que
--   é dado SENSÍVEL: a RLS de 0002 é só-autor na tabela base + há um GRANT de
--   coluna que revoga `correta` do papel `authenticated`, e o aluno responde o
--   quiz pela view `question_options_public` (que NÃO projeta `correta`). Se a
--   correção fosse feita no cliente, ela precisaria do gabarito — e isso o
--   vazaria. Por isso a nota é calculada por uma função SECURITY DEFINER que lê
--   `correta` no servidor e devolve SOMENTE o agregado (nota/aprovado/acertos),
--   nunca o gabarito nem o acerto por-questão. 0002 já anunciava esta peça:
--   "A correção/nota (Fase 4) será feita por uma RPC SECURITY DEFINER...".
--
-- REGRAS DO QUIZ (autoritativas no servidor; o app só as espelha para UX):
--   - Aprovação: nota >= 80%.
--   - Máximo de 3 tentativas por (usuário, módulo).
--   - Cooldown de 24h entre tentativas.
--   Essas regras são CONSTANTES no corpo da função — NÃO são parâmetros do
--   chamador (um `max_attempts` vindo do cliente derrotaria a trava). Se um dia
--   for preciso configurar por módulo, o ponto de extensão é uma tabela
--   `quiz_settings` lida aqui (defaults configuráveis NESTE ponto, não pelo
--   cliente).
--
-- MODELO DE ACESSO (resumo) de quiz_attempts:
--   - SELECT: o dono (profile_id = auth.uid()) lê as próprias tentativas; gestor
--     e autor leem todas (via public.current_user_role(), de 0001).
--   - SEM policy de INSERT/UPDATE/DELETE para o cliente: as linhas nascem
--     EXCLUSIVAMENTE dentro de submit_quiz (SECURITY DEFINER, ignora RLS). RLS
--     nega por padrão o que não é liberado, então o aluno não consegue forjar
--     uma tentativa (nota inflada) por escrita direta.
--
-- Como em 0003, `profile_id` referencia profiles(id) e, por 0001, profiles.id É
-- o próprio auth.users.id (= auth.uid()); logo o predicado de dono é
-- simplesmente `profile_id = auth.uid()`.
--
-- Datas em UTC (timestamptz -> now()); conversão para BRT é feita no app.
--
-- Idempotente / re-executável, seguindo a convenção de 0001/0002/0003:
--   - create table if not exists
--   - create index if not exists
--   - create or replace function
--   - drop policy if exists antes de create policy
--   - função SECURITY DEFINER sempre com set search_path = public
--
-- Aplicar manualmente via Supabase SQL Editor, DEPOIS de 0003. Ver
-- supabase/README.md. NÃO é aplicada automaticamente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Tabela: quiz_attempts
-- -----------------------------------------------------------------------------
-- Uma linha por TENTATIVA (não por usuário/módulo): o histórico de tentativas é
-- preservado — é ele que a RPC usa para contar tentativas e aplicar o cooldown.
--   - `nota`      : 0..100 (check). Calculada no servidor por submit_quiz.
--   - `aprovado`  : redundante-por-conveniência (= nota >= limite); gravado pela
--                   RPC para não depender do limite vigente na hora da leitura.
--   - `respostas` : o que o aluno enviou (jsonb question_id->option_id), guardado
--                   para AUDITORIA. Não contém gabarito.
-- FKs ON DELETE CASCADE: apagar o perfil (ou o usuário no Auth, que cascata para
-- profiles) ou o módulo remove as tentativas correspondentes.
create table if not exists public.quiz_attempts (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  module_id  uuid not null references public.modules  (id) on delete cascade,
  nota       int  not null check (nota between 0 and 100),
  aprovado   boolean not null,
  respostas  jsonb not null,
  created_at timestamptz not null default now()
);

comment on table  public.quiz_attempts is 'Tentativas de quiz por (usuário, módulo). Criadas SOMENTE pela RPC submit_quiz (SECURITY DEFINER). Dono lê as suas; gestor/autor leem todas.';
comment on column public.quiz_attempts.profile_id is 'Dono da tentativa; = profiles.id = auth.uid().';
comment on column public.quiz_attempts.nota is 'Nota 0..100 calculada no servidor por submit_quiz.';
comment on column public.quiz_attempts.aprovado is 'true se a nota atingiu o limite de aprovação vigente na correção.';
comment on column public.quiz_attempts.respostas is 'Respostas enviadas (jsonb: question_id -> option_id) para auditoria. NÃO contém gabarito.';
comment on column public.quiz_attempts.created_at is 'Instante da tentativa (UTC). Base para o cooldown de 24h. Exibição em BRT.';

-- -----------------------------------------------------------------------------
-- 2) Índices auxiliares
-- -----------------------------------------------------------------------------
-- (profile_id, module_id): a RPC conta tentativas e busca a última do usuário no
-- módulo; o app lista as tentativas do aluno naquele módulo.
-- (module_id): consultas/relatórios de gestor/autor por módulo.
create index if not exists idx_quiz_attempts_profile_module on public.quiz_attempts (profile_id, module_id);
create index if not exists idx_quiz_attempts_module_id      on public.quiz_attempts (module_id);

-- =============================================================================
-- 3) Row Level Security
-- =============================================================================
-- RLS nega por padrão o que não for explicitamente liberado.
alter table public.quiz_attempts enable row level security;

-- SELECT: o dono lê as próprias tentativas; gestor e autor leem todas (usa a
-- função helper SECURITY DEFINER de 0001 para descobrir o papel sem recursão).
drop policy if exists quiz_attempts_select on public.quiz_attempts;
create policy quiz_attempts_select
  on public.quiz_attempts
  for select
  to authenticated
  using (
    profile_id = auth.uid()
    or public.current_user_role() in ('gestor', 'autor')
  );

-- INSERT/UPDATE/DELETE: INTENCIONALMENTE SEM policy para o cliente.
-- As tentativas são criadas EXCLUSIVAMENTE por public.submit_quiz, que é
-- SECURITY DEFINER e portanto ignora a RLS ao inserir. Omitir as policies de
-- escrita = negar por padrão = o aluno não consegue inserir/alterar uma
-- tentativa direta (ex.: forjar nota=100 ou "resetar" o contador de tentativas
-- apagando linhas). Toda escrita passa obrigatoriamente pela correção server-side.

-- =============================================================================
-- 4) RPC de correção: public.submit_quiz(p_module_id, p_answers)
-- =============================================================================
-- CONTRATO:
--   Entrada:
--     p_module_id uuid  — o módulo cujo quiz está sendo respondido.
--     p_answers   jsonb — objeto { "<question_id>": "<option_id>", ... }, ambos
--                         uuid como texto. Questão sem resposta = errada.
--   Saída (jsonb, SOMENTE agregados):
--     { nota, aprovado, acertos, total, tentativa, tentativas_restantes,
--       proxima_liberacao }
--   NUNCA retorna o gabarito nem o acerto por-questão — isso vazaria `correta`
--   entre tentativas (o aluno inferiria as respostas certas por tentativa e
--   erro). É este o motivo de a função ser SECURITY DEFINER: ela roda com os
--   privilégios do dono e lê a coluna `correta` da tabela base
--   question_options, contornando a RLS só-autor e o GRANT de coluna de 0002.
--
-- SEGURANÇA: set search_path = public fixa a resolução de nomes, impedindo que
-- um search_path malicioso do chamador redirecione as tabelas para objetos
-- forjados (prática recomendada para SECURITY DEFINER, igual a 0001/0003).
--
-- ORDEM DAS VERIFICAÇÕES: autenticação -> módulo publicado -> limite de
-- tentativas -> cooldown -> existência de questões -> correção -> gravação.
-- Fazemos as travas ANTES de corrigir para não revelar nada (nem gravar linha)
-- quando a tentativa é inválida.
create or replace function public.submit_quiz(
  p_module_id uuid,
  p_answers   jsonb
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  -- Regras do quiz como CONSTANTES do servidor (defaults configuráveis AQUI, num
  -- só lugar — nunca via parâmetro do chamador). Seam futuro: uma tabela
  -- quiz_settings por módulo seria lida aqui.
  c_pass_pct      constant int      := 80;
  c_max_attempts  constant int      := 3;
  c_cooldown      constant interval := interval '24 hours';

  v_uid        uuid;
  v_attempts   int;             -- tentativas já existentes (usuário, módulo)
  v_last       timestamptz;     -- created_at da tentativa mais recente
  v_total      int;             -- nº de questões do módulo
  v_acertos    int;             -- nº de respostas corretas
  v_nota       int;
  v_aprovado   boolean;
  v_next_num   int;             -- número desta tentativa (existentes + 1)
  v_restantes  int;             -- tentativas restantes após esta
  v_proxima    timestamptz;     -- quando a próxima tentativa é liberada (ou null)
begin
  -- 1) Autenticação: sem sessão de usuário não há como atribuir a tentativa.
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501'; -- insufficient_privilege
  end if;

  -- 2) Módulo precisa existir E estar publicado (aluno só faz quiz de publicado).
  if not exists (
    select 1 from public.modules m
    where m.id = p_module_id
      and m.publicado = true
  ) then
    raise exception 'Módulo indisponível para avaliação.' using errcode = 'P0001';
  end if;

  -- 3) Limite de tentativas: conta as já existentes para (usuário, módulo).
  --    Bloqueia ao atingir o teto (independe de já ter sido aprovado; simples e
  --    seguro — reprovado ou aprovado, no máximo c_max_attempts tentativas).
  select count(*), max(created_at)
    into v_attempts, v_last
    from public.quiz_attempts
   where profile_id = v_uid
     and module_id  = p_module_id;

  if v_attempts >= c_max_attempts then
    raise exception 'Limite de % tentativas atingido para este módulo.', c_max_attempts
      using errcode = 'P0001';
  end if;

  -- 4) Cooldown: se a última tentativa foi há menos de c_cooldown, barra e
  --    informa quando a próxima é liberada.
  if v_last is not null and (now() - v_last) < c_cooldown then
    raise exception 'Aguarde até % para tentar novamente.', to_char((v_last + c_cooldown) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      using errcode = 'P0001';
  end if;

  -- 5) Correção. Total de questões do módulo (fonte da verdade do denominador).
  select count(*) into v_total
    from public.questions q
   where q.module_id = p_module_id;

  if v_total = 0 then
    raise exception 'Módulo sem questões cadastradas.' using errcode = 'P0001';
  end if;

  -- Conta acertos: para cada questão DO MÓDULO, pega a alternativa correta
  -- (correta = true) e compara com o option_id enviado em p_answers para aquela
  -- questão. Questão ausente em p_answers => sem match => erro (não conta).
  -- DEFENSIVO: o join restringe a questões de p_module_id e a opção correta é
  -- buscada dentro da própria questão, então respostas cujo question_id/option_id
  -- não pertençam a este módulo simplesmente não casam e são ignoradas.
  select count(*) into v_acertos
    from public.questions q
    join public.question_options qo
      on qo.question_id = q.id
     and qo.correta = true
   where q.module_id = p_module_id
     and (p_answers ->> q.id::text) is not null
     and (p_answers ->> q.id::text) = qo.id::text;

  -- Nota percentual arredondada (0..100). round(numeric) evita truncamento.
  v_nota     := round(100.0 * v_acertos / v_total);
  v_aprovado := v_nota >= c_pass_pct;

  -- 6) Gravação da tentativa (aqui, SECURITY DEFINER ignora a ausência de policy
  --    de INSERT para o cliente). `respostas` guarda o payload para auditoria.
  insert into public.quiz_attempts (profile_id, module_id, nota, aprovado, respostas)
  values (v_uid, p_module_id, v_nota, v_aprovado, p_answers);

  -- 7) Metadados de retorno. Esta é a tentativa (existentes + 1).
  v_next_num  := v_attempts + 1;
  v_restantes := c_max_attempts - v_next_num;

  -- proxima_liberacao: só faz sentido se o aluno PODE e PRECISA tentar de novo
  -- (não aprovado E ainda tem tentativa restante). Caso contrário, null.
  if not v_aprovado and v_restantes > 0 then
    v_proxima := now() + c_cooldown;
  else
    v_proxima := null;
  end if;

  -- Retorna SOMENTE agregados. NUNCA o gabarito nem o acerto por-questão (isso
  -- permitiria deduzir `correta` ao longo das tentativas).
  return jsonb_build_object(
    'nota',                 v_nota,
    'aprovado',             v_aprovado,
    'acertos',              v_acertos,
    'total',                v_total,
    'tentativa',            v_next_num,
    'tentativas_restantes', v_restantes,
    'proxima_liberacao',    v_proxima
  );
end;
$$;

comment on function public.submit_quiz(uuid, jsonb) is
  'Corrige o quiz de um módulo no servidor (SECURITY DEFINER): lê o gabarito question_options.correta, aplica regras (>=80% aprova, máx 3 tentativas, cooldown 24h), grava a tentativa e devolve SÓ os agregados. Nunca expõe o gabarito ao cliente.';

-- EXECUTE para authenticated: é a única porta de entrada para criar tentativas.
-- (SECURITY DEFINER faz a função rodar com privilégio do dono ao gravar.)
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;
