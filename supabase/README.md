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

Um guia de deploy completo (CLI, ambientes, seeds) será escrito separadamente.
