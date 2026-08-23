# ContrataPJ Academy

PWA de **treinamento interno** da ContrataPJ — estilo streaming (Netflix, tema escuro) reunindo os **184 playbooks comerciais** em **12 módulos**, com trilha sequencial, testes com certificação (≥80%), cadeia de metas e painel de gestão.

> Uso interno. Repositório privado.

## Stack

- **Frontend:** React + Vite + TypeScript + TailwindCSS (PWA via `vite-plugin-pwa`)
- **Backend:** Supabase (Postgres + RLS + Auth + Storage + Edge Functions)
- **Roteamento/Dados:** React Router + TanStack Query
- **Vídeo:** embed de YouTube não listado (`youtube_id`)
- **Certificados:** geração de PDF (pdf-lib / react-pdf)

## Identidade visual

Tema escuro (`#0a0a0c`) com as cores ContrataPJ: azul-marinho `#1C265E`, azul royal `#4259DF`, coral `#DE5968`, branco `#f4f6ff`.

## Perfis

- **Aluno** — assiste aulas, faz testes, ganha certificados, vê metas.
- **Gestor** — cria turmas, define metas, acompanha progresso/ranking/relatórios.
- **Autor** — CMS de módulos, aulas e banco de questões.

## Documentação

- Spec/design: [`docs/specs/2026-08-22-contratapj-academy-design.md`](docs/specs/2026-08-22-contratapj-academy-design.md)
- Plano de implementação (7 fases): [`docs/plans/2026-08-22-contratapj-academy.md`](docs/plans/2026-08-22-contratapj-academy.md)

## Roadmap (fases)

- **Fase 0** — Fundação (React+Vite+Tailwind+PWA, tema, Supabase conectado, CI)
- **Fase 1** — Auth & perfis (login/magic link, roles, guarda de rotas)
- **Fase 2** — Conteúdo (schema + seed dos 184 MD)
- **Fase 3** — Experiência do aluno (home streaming, player, trilha travada)
- **Fase 4** — Testes & certificados (quiz 80%/3 tentativas/24h, PDF 12+1)
- **Fase 5** — Cadeia de metas & gestão (dashboard do gestor, ranking, relatórios)
- **Fase 6** — CMS do autor

## Setup (a preencher na Fase 0)

```bash
npm install
cp .env.example .env   # preencher VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

## Notas de deploy

- Migrations aplicadas via **SQL Editor** do Supabase.
- Edge functions com deploy manual (`supabase functions deploy`).
- Datas: gravar em UTC, exibir em **BRT (UTC-3)**.
