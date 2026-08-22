# ContrataPJ Academy — Guia de Deploy (Fase 1: Auth & perfis)

Este guia cobre o que já está implementado (**Fase 0 – Fundação** e **Fase 1 – Auth & perfis**)
e mostra, passo a passo, como subir um projeto Supabase, aplicar as migrations, ligar o login
e validar que os papéis (aluno/gestor/autor) funcionam de verdade.

> Estado do código nesta rodada: scaffold + tema dark + PWA + client Supabase + **profiles/RLS**
> + **AuthProvider (senha e magic link)** + **guarda de rotas por papel**. As telas reais (Home,
> player, testes, certificados, metas, CMS) são as Fases 3–6 e ainda **não** existem — hoje as
> rotas protegidas mostram *stubs* ("Início do aluno", "Painel do gestor", "CMS do autor").

---

## 0. Pré-requisitos

- Node 20+ e npm 11+ (já validados no ambiente de desenvolvimento).
- Uma conta no [Supabase](https://supabase.com).
- O repositório em `~/contratapj-academy`.

```bash
cd ~/contratapj-academy
npm install
```

---

## 1. Criar o projeto Supabase

1. Acesse https://supabase.com/dashboard → **New project**.
2. Nome sugerido: `contratapj-academy`. Escolha uma senha forte para o Postgres (guarde-a) e a
   região mais próxima (ex.: São Paulo, se disponível).
3. Aguarde o provisionamento (~2 min).
4. Em **Project Settings → API**, anote:
   - **Project URL** → vira `VITE_SUPABASE_URL`.
   - **anon / public key** → vira `VITE_SUPABASE_ANON_KEY`.
   - (A **service_role key** é secreta — não vai para o front. Só use no SQL Editor / backend.)

---

## 2. Aplicar as migrations (SQL Editor)

As migrations ficam em `supabase/migrations/`, numeradas em ordem. Nesta fase há apenas:

- `0001_profiles.sql` — tabela `profiles`, papéis (aluno/gestor/autor), trigger que cria o perfil
  no signup, e as políticas de RLS.

**Como aplicar:**

1. No dashboard, abra **SQL Editor → New query**.
2. Cole o conteúdo **inteiro** de `supabase/migrations/0001_profiles.sql` e clique **Run**.
3. Confirme sucesso (sem erros). O script é re-executável com segurança (usa `if not exists` /
   `create or replace` / `drop ... if exists`), então rodar de novo não quebra.

> ⚠️ Aplique sempre na ordem numérica (0001, depois 0002, …) conforme novas migrations chegarem
> nas próximas fases. Ver também `supabase/README.md`.

**O que o 0001 garante:**
- `profiles(id → auth.users, nome, role, avatar_url, created_at)`, `role` default `aluno`.
- Ao criar um usuário no Auth, um perfil é criado automaticamente (trigger `SECURITY DEFINER`).
- RLS: cada um lê/edita **o próprio** perfil; **gestor** e **autor** leem **todos** (via a função
  `current_user_role()`, que evita recursão de RLS).
- Um usuário comum **não consegue** promover o próprio papel (trigger de proteção). Promoção de
  papel só via `service_role` / SQL Editor (ver passo 6).

---

## 3. Configurar o Auth (e-mail + senha e magic link)

Em **Authentication → Providers / Sign In**:

1. **Email** habilitado (é o provider padrão). O app usa dois fluxos: **senha** e **magic link**.
2. **Confirm email:** para uso interno, você pode:
   - Deixar a confirmação de e-mail **ligada** (mais seguro; o usuário confirma antes de entrar), ou
   - Desligar para agilizar os primeiros testes (Authentication → Providers → Email → *Confirm email* off).
     Reative depois se quiser.
3. **URLs de redirecionamento** (Authentication → **URL Configuration**): o magic link redireciona
   para `window.location.origin`. Adicione:
   - **Site URL:** `http://localhost:5173` (dev). Em produção, a URL do deploy.
   - **Redirect URLs:** inclua `http://localhost:5173` (e a URL de produção quando existir).
   Sem isso, o link mágico recusa o redirect.

> Observação: a tela de login já trata mensagens de erro comuns (e-mail/senha incorretos,
> rate-limit, e-mail inválido) em PT-BR.

---

## 4. Configurar o `.env` do app

Copie o exemplo e preencha com os valores do passo 1:

```bash
cp .env.example .env.local
```

`.env.local`:
```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

> `.env.local` está no `.gitignore` — não será commitado. O client Supabase é *lazy*: se faltar
> uma variável, ele lança um erro claro nomeando qual falta, no primeiro uso.

---

## 5. Rodar o app localmente

```bash
npm run dev
```
Abra `http://localhost:5173`. Você deve cair no fluxo de login (rota `/` é protegida e redireciona
para `/login` sem sessão).

Outros comandos:
```bash
npm test        # 23 testes (unitários, com mocks — não precisam de Supabase real)
npm run build   # build de produção + PWA (service worker + manifest)
npm run lint    # oxlint
npm run preview # serve o build (útil pra testar a instalação da PWA)
```

---

## 6. Criar o primeiro usuário e definir papéis

O primeiro cadastro nasce como **aluno**. Como um usuário comum **não pode** se autopromover,
a mudança de papel é feita por você via SQL Editor (que roda como `service_role`, permitido pelo
trigger de proteção).

1. **Crie o usuário:** entre pelo app (magic link ou senha) OU crie manualmente em
   **Authentication → Users → Add user**. O trigger cria o `profiles` automaticamente.
2. **Descubra o id** (ou use o e-mail direto no update abaixo).
3. **Promova a gestor ou autor** no SQL Editor:

```sql
-- promover por e-mail
update public.profiles p
set role = 'gestor'   -- ou 'autor'
from auth.users u
where u.id = p.id
  and u.email = 'fulano@contratapj.com.br';
```

Para o "dono" do conteúdo (você), provavelmente `autor` (acesso ao CMS quando existir) e/ou
`gestor` (painel do time). Note que hoje um usuário tem **um** papel; multipapel, se necessário,
é decisão de fase futura.

---

## 7. Validar a RLS e a navegação por papel

Depois de ter ao menos um usuário de cada papel:

- **Aluno** → acessa `/` (stub "Início do aluno"). Ao tentar `/gestor` ou `/autor`, é
  redirecionado para `/` (bloqueado).
- **Gestor** → acessa `/` e `/gestor`. `/autor` é bloqueado.
- **Autor** → acessa `/` e `/autor`. `/gestor` é bloqueado.
- **Sem sessão** → qualquer rota protegida manda para `/login`.

Teste rápido de RLS no SQL Editor (opcional, avançado): use `Authentication → Users → (impersonate)`
ou valide via app com contas diferentes. Um aluno logado só deve conseguir `select` do próprio
perfil; gestor/autor devem ver todos.

---

## 8. Notas importantes

- **Datas:** o banco grava em UTC (`timestamptz`). A exibição no app deve ser sempre em **BRT
  (UTC-3)** — a ser aplicado nas telas das próximas fases.
- **Edge functions / PDF de certificado:** virão nas Fases 4+ e têm deploy **manual**
  (`supabase functions deploy`), sem CI.
- **Migrations:** aplicar **manualmente** via SQL Editor (o `db push` pode travar por histórico).
  Mantenha a numeração e rode em ordem.
- **Não existe** ainda: seed dos 184 playbooks, telas do aluno, testes, certificados, metas e CMS.
  Isso é o conteúdo das Fases 2–6.

---

## Checklist rápido

- [ ] Projeto Supabase criado; URL + anon key em mãos
- [ ] `0001_profiles.sql` aplicado no SQL Editor sem erros
- [ ] Email provider + Site URL + Redirect URLs configurados
- [ ] `.env.local` preenchido
- [ ] `npm run dev` sobe e cai no `/login`
- [ ] 1 usuário criado e promovido a gestor/autor via SQL
- [ ] Navegação por papel validada (aluno/gestor/autor)
