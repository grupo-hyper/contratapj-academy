-- =============================================================================
-- 0005_certificates.sql
-- ContrataPJ Academy — Fase 4 (Testes & certificados) — EMISSÃO DE CERTIFICADOS
--
-- Cria a tabela `public.certificates` e o mecanismo de EMISSÃO AUTOMÁTICA e
-- CONFIÁVEL de certificados, disparado quando o aluno é APROVADO no quiz de um
-- módulo (linha com aprovado=true em quiz_attempts, gravada por submit_quiz).
--
-- POR QUE A EMISSÃO É SERVER-SIDE (o ponto central desta migration):
--   Um certificado é uma AFIRMAÇÃO DE MÉRITO — precisa ser CONFIÁVEL. Se o
--   cliente pudesse inserir linhas em `certificates`, um aluno forjaria um
--   certificado (de módulo ou o final) sem nunca ter sido aprovado. Por isso,
--   assim como quiz_attempts em 0004:
--     - a tabela NÃO tem policy de INSERT/UPDATE/DELETE para o cliente (nega por
--       padrão); e
--     - a emissão acontece EXCLUSIVAMENTE dentro de um trigger SECURITY DEFINER
--       sobre quiz_attempts, que roda com privilégio do dono e ignora a RLS.
--   A fonte da verdade da emissão é a APROVAÇÃO no quiz (aprovado=true), que só
--   nasce dentro de submit_quiz (0004, também SECURITY DEFINER). Não há caminho
--   pelo qual o aluno crie um certificado sem passar por uma aprovação real.
--
-- REGRAS DE EMISSÃO:
--   a) CERTIFICADO DE MÓDULO ('modulo'): 1 por (aluno, módulo). Emitido na
--      PRIMEIRA aprovação naquele módulo. Reprovar/re-passar não gera duplicata
--      (índice único parcial + on conflict do nothing) — mantém-se o PRIMEIRO.
--   b) CERTIFICADO FINAL ('final'): 1 por aluno. Emitido quando o aluno concluiu
--      o CURSO. A definição de "curso concluído" está documentada no trigger.
--
-- REUTILIZA (não reinventa):
--   - public.profiles.id = auth.users(id) = auth.uid() (0001). Predicado de dono
--     em RLS = `profile_id = auth.uid()`.
--   - public.current_user_role() (0001, SECURITY DEFINER) para a leitura de
--     gestor/autor sem recursão.
--   - public.modules.publicado (0002) para definir o conjunto do curso.
--   - public.quiz_attempts (0004): a linha aprovado=true é o gatilho da emissão.
--
-- Datas em UTC (timestamptz -> now()); conversão para BRT é feita no app.
--
-- Idempotente / re-executável, seguindo a convenção de 0001..0004:
--   - create table if not exists
--   - create unique index / index if not exists
--   - create or replace function
--   - drop trigger if exists antes de create trigger
--   - drop policy if exists antes de create policy
--   - função SECURITY DEFINER sempre com set search_path = public
--
-- Aplicar manualmente via Supabase SQL Editor, DEPOIS de 0004. Ver
-- supabase/README.md. NÃO é aplicada automaticamente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Tabela: certificates
-- -----------------------------------------------------------------------------
-- Uma linha por certificado emitido.
--   - `tipo`       : 'modulo' (certificado de um módulo) ou 'final' (do curso).
--   - `module_id`  : preenchido para tipo='modulo'; NULL para tipo='final'
--                    (o CHECK abaixo amarra tipo<->module_id).
--   - `nota`       : para 'modulo', a nota da aprovação (0..100); para 'final', a
--                    MÉDIA (arredondada) das notas dos certificados de módulo do
--                    aluno. Pode ser NULL em teoria; o check só valida a faixa.
--   - `codigo_verificacao` : código público, humano-compartilhável, para
--                    verificação do certificado. 32 chars HEX MAIÚSCULOS,
--                    derivado de gen_random_uuid() (função CORE do Postgres —
--                    NÃO depende da extensão pgcrypto). Efetivamente único
--                    (constraint UNIQUE garante a unicidade real).
-- FKs ON DELETE CASCADE: apagar o perfil (ou o usuário no Auth, que cascata para
-- profiles) ou o módulo remove os certificados correspondentes.
create table if not exists public.certificates (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references public.profiles (id) on delete cascade,
  tipo                text not null check (tipo in ('modulo', 'final')),
  module_id           uuid references public.modules (id) on delete cascade,
  nota                int  check (nota is null or nota between 0 and 100),
  codigo_verificacao  text not null unique
                        default upper(replace(gen_random_uuid()::text, '-', '')),
  created_at          timestamptz not null default now(),
  -- Amarra tipo<->module_id: certificado de módulo TEM module_id; o final NÃO
  -- tem (o final é do curso inteiro, não de um módulo específico).
  constraint certificates_tipo_module_chk check (
    (tipo = 'modulo' and module_id is not null)
    or (tipo = 'final' and module_id is null)
  )
);

comment on table  public.certificates is 'Certificados emitidos: de módulo (1 por aluno/módulo, na 1ª aprovação) e final (1 por aluno, ao concluir o curso). Criados SOMENTE pelo trigger emit_certificates_on_pass (SECURITY DEFINER). Dono lê os seus; gestor/autor leem todos.';
comment on column public.certificates.tipo is 'Tipo do certificado: modulo (de um módulo) ou final (do curso).';
comment on column public.certificates.module_id is 'Módulo do certificado (tipo=modulo). NULL para tipo=final.';
comment on column public.certificates.nota is 'Nota 0..100. Para modulo: nota da aprovação. Para final: média (arredondada) das notas dos certificados de módulo do aluno.';
comment on column public.certificates.codigo_verificacao is 'Código público de verificação (32 hex maiúsculos, de gen_random_uuid core). Único; compartilhável.';
comment on column public.certificates.created_at is 'Instante da emissão (UTC). Exibição em BRT.';

-- -----------------------------------------------------------------------------
-- 2) Índices / unicidade
-- -----------------------------------------------------------------------------
-- UNICIDADE (índices únicos PARCIAIS — a regra difere por tipo):
--   (a) no máximo 1 certificado de MÓDULO por (aluno, módulo). É o que torna a
--       re-aprovação idempotente (com `on conflict do nothing` no trigger).
--   (b) no máximo 1 certificado FINAL por aluno.
-- Índices parciais (WHERE tipo=...) evitam que a regra de um tipo interfira no
-- outro (ex.: o final, com module_id NULL, não colide na regra de módulo).
create unique index if not exists uq_certificates_modulo
  on public.certificates (profile_id, module_id)
  where tipo = 'modulo';

create unique index if not exists uq_certificates_final
  on public.certificates (profile_id)
  where tipo = 'final';

-- Índice de listagem: "Meus certificados" busca todos os do aluno (Task 4.4).
-- Existe porque o uq_certificates_final é PARCIAL (WHERE tipo='final') e não
-- serve a consulta "liste TODOS os meus certificados" (módulo + final).
-- (O índice do codigo_verificacao já é criado pela constraint UNIQUE.)
create index if not exists idx_certificates_profile_id
  on public.certificates (profile_id);

-- =============================================================================
-- 3) Row Level Security
-- =============================================================================
-- RLS nega por padrão o que não for explicitamente liberado.
alter table public.certificates enable row level security;

-- SELECT: o dono lê os próprios certificados; gestor e autor leem todos (usa a
-- função helper SECURITY DEFINER de 0001 para descobrir o papel sem recursão).
drop policy if exists certificates_select on public.certificates;
create policy certificates_select
  on public.certificates
  for select
  to authenticated
  using (
    profile_id = auth.uid()
    or public.current_user_role() in ('gestor', 'autor')
  );

-- INSERT/UPDATE/DELETE: INTENCIONALMENTE SEM policy para o cliente.
-- Os certificados são emitidos EXCLUSIVAMENTE pelo trigger
-- emit_certificates_on_pass (SECURITY DEFINER, ignora RLS). Omitir as policies
-- de escrita = negar por padrão = o aluno NÃO consegue FORJAR um certificado
-- (de módulo ou o final) por escrita direta, nem alterar a nota/código de um já
-- emitido. Toda emissão passa obrigatoriamente por uma aprovação real no quiz.

-- =============================================================================
-- 4) Trigger de emissão: emit_certificates_on_pass()
-- =============================================================================
-- Dispara AFTER INSERT em quiz_attempts, SOMENTE quando new.aprovado é true
-- (cláusula WHEN filtra no motor, sem custo quando reprovado). Emite:
--   a) o certificado do MÓDULO recém-aprovado; e
--   b) se o aluno concluiu o curso, o certificado FINAL.
--
-- DEFINIÇÃO DE "CURSO CONCLUÍDO" (documentada e intencional):
--   CURSO CONCLUÍDO = APROVADO EM TODOS OS MÓDULOS PUBLICADOS.
--   Contamos os certificados de módulo do aluno cujo module_id é de um módulo
--   PUBLICADO (join em modules com publicado=true) e comparamos com a quantidade
--   de módulos publicados. Se o aluno tem certificado para TODOS os publicados
--   (e há >= 1 publicado), emite o final.
--   Essa definição CRESCE com o conteúdo e fica consistente com a trilha da Home
--   (computeUnlockState), que considera o curso concluído quando todos os
--   módulos publicados estão feitos. NOTA: isso pode diferir de um literal
--   "exatamente 12" enquanto houver menos de 12 publicados — é INTENCIONAL: o
--   curso só está finalizado quando os 12 estiverem publicados e aprovados.
--   Restringir a contagem a módulos PUBLICADOS evita que um módulo despublicado
--   ou removido distorça o cálculo de conclusão.
--
-- SEGURANÇA: SECURITY DEFINER (para inserir em certificates ignorando a ausência
-- de policy de INSERT) + set search_path = public (fixa a resolução de nomes,
-- impedindo redirecionamento por search_path malicioso — igual a 0001/0003/0004).
--
-- IDEMPOTÊNCIA: os `on conflict do nothing` apoiados nos índices únicos parciais
-- da seção 2 tornam a re-emissão inócua — re-passar um módulo (dentro do limite
-- de tentativas) não duplica certificado, e o final é emitido no máximo uma vez.
create or replace function public.emit_certificates_on_pass()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_publicados int;   -- nº de módulos publicados (o "curso" atual)
  v_concluidos int;   -- nº de módulos publicados que o aluno já tem certificado
  v_media      int;   -- média das notas dos certificados de módulo (p/ o final)
begin
  -- TRAVA DE CONCORRÊNCIA POR ALUNO (fecha a corrida cross-module do final).
  -- Lock consultivo com escopo de TRANSAÇÃO, chaveado pelo PROFILE (não por
  -- profile+module como em 0004). POR QUÊ: o lock de 0004 serializa apenas o
  -- MESMO (usuário, módulo); duas chamadas de submit_quiz do MESMO aluno em
  -- MÓDULOS DIFERENTES rodam de fato em paralelo. Sob READ COMMITTED, cada
  -- trigger enxergaria só o próprio certificado de módulo recém-inserido (não o
  -- do outro, ainda não commitado) — se fossem os DOIS últimos módulos, ambos
  -- calculariam v_concluidos < v_publicados e NENHUM emitiria o final, deixando
  -- o aluno para sempre sem certificado final (não há reavaliação posterior: o
  -- final só é computado neste INSERT de quiz_attempts). Serializando por aluno,
  -- o segundo trigger a rodar já enxerga o certificado de módulo COMMITADO pelo
  -- primeiro e emite o final corretamente.
  -- SEM DEADLOCK: chave/namespace diferente do lock de 0004 ('cert:' vs a chave
  -- crua de 0004) e ordem de aquisição consistente — em submit_quiz o lock de
  -- módulo de 0004 é SEMPRE tomado primeiro, e este lock por profile é tomado
  -- depois, dentro do trigger AFTER.
  perform pg_advisory_xact_lock(hashtext('cert:' || new.profile_id::text));

  -- EMISSÃO FAIL-OPEN (escolha DELIBERADA). Este trigger é AFTER INSERT, na
  -- MESMA transação do insert de submit_quiz; se o corpo de emissão levantasse
  -- exceção, faria ROLLBACK da tentativa aprovada legitimamente. Hoje nenhum
  -- caminho lança (os CHECKs são satisfeitos por construção e o on-conflict
  -- absorve duplicatas), mas essa invariante é frágil. Envolvemos a emissão num
  -- bloco exception que apenas EMITE WARNING e segue: uma falha de certificado
  -- NÃO pode custar ao aluno o seu registro de aprovação.
  -- CONTRASTE INTENCIONAL com handle_new_user (0001), que é FAIL-CLOSED: lá uma
  -- falha DEVE abortar (não pode existir usuário órfão sem perfil); aqui um
  -- certificado ausente jamais deve custar a aprovação. O advisory lock acima
  -- fica FORA (antes) deste bloco de propósito.
  begin
    -- a) Certificado do MÓDULO recém-aprovado. Guarda a nota da aprovação.
    --    on conflict do nothing (alvo explícito no índice único parcial): se já
    --    existe (re-aprovação), mantém o PRIMEIRO.
    insert into public.certificates (profile_id, tipo, module_id, nota)
    values (new.profile_id, 'modulo', new.module_id, new.nota)
    on conflict (profile_id, module_id) where tipo = 'modulo' do nothing;

    -- b) Conclusão do curso: aprovado em TODOS os módulos PUBLICADOS.
    select count(*) into v_publicados
      from public.modules
     where publicado = true;

    -- Conta os certificados de módulo do aluno que apontam para módulos
    -- PUBLICADOS (um certificado órfão de módulo despublicado/removido não conta).
    select count(*) into v_concluidos
      from public.certificates c
      join public.modules m
        on m.id = c.module_id
       and m.publicado = true
     where c.profile_id = new.profile_id
       and c.tipo = 'modulo';

    if v_publicados >= 1 and v_concluidos >= v_publicados then
      -- Média (arredondada) das notas dos certificados de módulo do aluno para
      -- os módulos publicados — nota "geral" exibida no certificado final.
      select round(avg(c.nota))::int into v_media
        from public.certificates c
        join public.modules m
          on m.id = c.module_id
         and m.publicado = true
       where c.profile_id = new.profile_id
         and c.tipo = 'modulo';

      -- 1 final por aluno (índice único parcial). on conflict do nothing (alvo
      -- explícito) torna a emissão idempotente caso o gatilho reincida.
      insert into public.certificates (profile_id, tipo, module_id, nota)
      values (new.profile_id, 'final', null, v_media)
      on conflict (profile_id) where tipo = 'final' do nothing;
    end if;
  exception
    when others then
      -- FAIL-OPEN: registra o problema mas NÃO propaga (preserva a tentativa).
      raise warning 'emissão de certificado falhou (profile=%, module=%): %',
        new.profile_id, new.module_id, sqlerrm;
  end;

  return null; -- AFTER trigger: o valor de retorno é ignorado.
end;
$$;

comment on function public.emit_certificates_on_pass() is
  'Trigger AFTER INSERT em quiz_attempts (WHEN aprovado): emite o certificado do módulo aprovado e, se o aluno concluiu TODOS os módulos publicados, o certificado final. SECURITY DEFINER para ignorar a RLS de certificates; idempotente via índices únicos parciais + on conflict do nothing.';

-- (Re)cria o trigger de forma idempotente. WHEN (new.aprovado) filtra no motor:
-- reprovação não invoca a função.
drop trigger if exists trg_emit_certificates_on_pass on public.quiz_attempts;
create trigger trg_emit_certificates_on_pass
  after insert on public.quiz_attempts
  for each row
  when (new.aprovado)
  execute function public.emit_certificates_on_pass();
