-- 0009_areas.sql — entidade Área acima dos módulos (Fase 1: organizar)
-- 1) Tabela areas
create table if not exists public.areas (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null check (length(btrim(nome)) > 0),
  slug         text not null unique,
  descricao    text,
  capa_url     text,
  visibilidade text not null default 'publica' check (visibilidade in ('publica','restrita')),
  ordem        int  not null,
  publicado    boolean not null default true,
  created_at   timestamptz not null default now()
);
alter table public.areas enable row level security;
-- F1: leitura de áreas publicadas p/ todos; escrita só admin (RLS por área vem na F2/F3).
drop policy if exists areas_select on public.areas;
create policy areas_select on public.areas for select to authenticated
  using (publicado = true or public.is_admin());
drop policy if exists areas_admin_all on public.areas;
create policy areas_admin_all on public.areas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.areas to authenticated;

-- 2) Área "Comercial" (só cria se ainda não houver nenhuma área)
insert into public.areas (nome, slug, descricao, visibilidade, ordem, publicado)
select 'Comercial', 'comercial', 'Playbooks do time Comercial (Contrata PJ).', 'publica', 1, true
where not exists (select 1 from public.areas);

-- 3) modules.area_id + backfill + constraints por área
alter table public.modules add column if not exists area_id uuid references public.areas (id) on delete cascade;
update public.modules set area_id = (select id from public.areas where slug = 'comercial')
  where area_id is null;
alter table public.modules alter column area_id set not null;
-- troca a unicidade/globalidade de ordem para por-área
alter table public.modules drop constraint if exists modules_ordem_key;      -- unique(ordem) auto-nome
alter table public.modules drop constraint if exists modules_ordem_check;    -- check(1..12) auto-nome
-- (se os nomes acima diferirem, ver: select conname from pg_constraint where conrelid='public.modules'::regclass;)
alter table public.modules add constraint modules_area_ordem_key unique (area_id, ordem);
alter table public.modules add constraint modules_ordem_pos_check check (ordem >= 1);
create index if not exists idx_modules_area_id on public.modules (area_id);
