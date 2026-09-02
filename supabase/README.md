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
- `0003_progress.sql` — progresso por (usuário, aula): `lesson_progress` (pct + conclusão), owner-only; base da trilha sequencial travada.
- `0004_quiz.sql` — motor do teste: tentativas e regras (≥80% aprova, máx 3 tentativas, espera 24h).
- `0005_certificates.sql` — emissão de certificados (12 de módulo + 1 final) com código de verificação; RLS dono (+ gestor lê).
- `0006_goals.sql` — cadeia de metas & gestão: `classes`, `enrollments` e `class_goals` (meta = **só ritmo global**, `modules_per_week`); RLS: gestor escreve, aluno lê o que lhe diz respeito.

Um guia de deploy completo (CLI, ambientes, seeds) será escrito separadamente.
