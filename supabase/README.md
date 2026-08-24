# supabase/

Backend da ContrataPJ Academy: Postgres + RLS + Auth no Supabase.

## Migrations

Arquivos em `migrations/` são numerados sequencialmente (`0001_*.sql`, `0002_*.sql`, …).
Como ainda não há CLI/CI configurado, aplique-os **manualmente** e **em ordem crescente**
pelo **SQL Editor** do painel do Supabase: abra cada arquivo, cole o conteúdo e execute
`0001`, depois `0002`, e assim por diante. As migrations são escritas para serem
re-executáveis (`create ... if not exists`, `create or replace`, `drop ... if exists`),
então rodar de novo por engano não deve quebrar o schema.

> Datas são gravadas em UTC; a conversão para BRT é feita no app.

### Lista de migrations

- `0001_profiles.sql` — perfis (1:1 com auth.users), papéis (aluno/gestor/autor), trigger de criação de perfil e RLS.
- `0002_content.sql` — conteúdo do curso: módulos, aulas, questões e alternativas; RLS de leitura pública interna (publicados) e escrita restrita a `autor`; view `question_options_public` que expõe alternativas sem o gabarito (`correta`).

Um guia de deploy completo (CLI, ambientes, seeds) será escrito separadamente.
